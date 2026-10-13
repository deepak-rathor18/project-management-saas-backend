import mongoose from "mongoose";

const activitySchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      index: true,
    },
    task: { type: mongoose.Schema.Types.ObjectId, ref: "Task" },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: { type: String, required: true },
    detail: { type: String, required: true },
  },
  { timestamps: true },
);

activitySchema.index({ organization: 1, project: 1, createdAt: -1 });

export default mongoose.model("Activity", activitySchema);
