import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
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
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 4000, default: "" },
    assignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["TODO", "IN_PROGRESS", "IN_REVIEW", "COMPLETED"],
      default: "TODO",
    },
    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      default: "MEDIUM",
    },
    dueDate: Date,
    labels: [{ type: String, trim: true, maxlength: 30 }],
  },
  { timestamps: true },
);

taskSchema.index({ organization: 1, project: 1, status: 1, updatedAt: -1 });
taskSchema.index({ organization: 1, assignee: 1, status: 1 });
taskSchema.index({ title: "text", description: "text" });

export default mongoose.model("Task", taskSchema);
