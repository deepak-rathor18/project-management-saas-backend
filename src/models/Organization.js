import mongoose from "mongoose";

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 500, default: "" },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    members: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        role: {
          type: String,
          enum: ["OWNER", "ADMIN", "MEMBER"],
          required: true,
        },
      },
    ],
  },
  { timestamps: true },
);

organizationSchema.index({ "members.user": 1 });

export default mongoose.model("Organization", organizationSchema);
