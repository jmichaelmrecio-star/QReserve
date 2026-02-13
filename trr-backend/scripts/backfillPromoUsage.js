// Backfill promo code usage counts based on approved payments.
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const Reservation = require("../models/Reservation");
const PromoCode = require("../models/PromoCode");

const APPROVED_PAYMENT_STATUSES = new Set([
  "PAID",
  "DOWNPAYMENT_PAID",
  "PARTIALLY-PAID",
  "FULLY-PAID",
]);

function normalizeStatus(value) {
  return String(value || "").trim().toUpperCase();
}

async function backfillPromoUsage() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI is not set. Please configure your .env file.");
  }

  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  try {
    const reservations = await Reservation.find({
      discountCode: { $exists: true, $ne: "" },
    }).select("_id discountCode paymentStatus isMultiAmenity multiAmenityGroupId promoUsageApplied");

    const countedKeys = new Set();
    const promoCounts = new Map();
    const reservationIdsToMark = new Set();

    for (const reservation of reservations) {
      const paymentStatus = normalizeStatus(reservation.paymentStatus);
      if (!APPROVED_PAYMENT_STATUSES.has(paymentStatus)) {
        continue;
      }

      const promoCode = String(reservation.discountCode || "").toUpperCase();
      if (!promoCode) {
        continue;
      }

      const groupKey = reservation.isMultiAmenity && reservation.multiAmenityGroupId
        ? reservation.multiAmenityGroupId.toString()
        : reservation._id.toString();

      const uniqueKey = `${promoCode}|${groupKey}`;
      if (countedKeys.has(uniqueKey)) {
        reservationIdsToMark.add(reservation._id.toString());
        continue;
      }

      countedKeys.add(uniqueKey);
      promoCounts.set(promoCode, (promoCounts.get(promoCode) || 0) + 1);
      reservationIdsToMark.add(reservation._id.toString());
    }

    const promos = await PromoCode.find().select("_id code usageLimit timesUsed");
    const bulkPromoOps = [];

    for (const promo of promos) {
      const code = String(promo.code || "").toUpperCase();
      if (!code) {
        continue;
      }

      const nextCount = promoCounts.get(code) || 0;
      if (promo.timesUsed !== nextCount) {
        bulkPromoOps.push({
          updateOne: {
            filter: { _id: promo._id },
            update: { $set: { timesUsed: nextCount } },
          },
        });
      }
    }

    if (bulkPromoOps.length > 0) {
      const result = await PromoCode.bulkWrite(bulkPromoOps);
      console.log("Updated promo codes:", result.modifiedCount);
    } else {
      console.log("No promo codes needed updates.");
    }

    if (reservationIdsToMark.size > 0) {
      const ids = Array.from(reservationIdsToMark).map(id => new mongoose.Types.ObjectId(id));
      const updateResult = await Reservation.updateMany(
        { _id: { $in: ids } },
        { $set: { promoUsageApplied: true } }
      );
      console.log("Marked reservations with promoUsageApplied:", updateResult.modifiedCount);
    } else {
      console.log("No reservations needed promoUsageApplied updates.");
    }
  } finally {
    await mongoose.disconnect();
  }
}

backfillPromoUsage()
  .then(() => {
    console.log("Promo usage backfill complete.");
  })
  .catch(error => {
    console.error("Promo usage backfill failed:", error);
    process.exitCode = 1;
  });
