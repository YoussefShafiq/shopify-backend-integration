import { model, Schema } from "mongoose";

const processStepSchema = new Schema(
    {
        name: { type: String, required: true },
        slug: { type: String, required: true },
        image: { type: String, default: "" },
    },
    { _id: false }
);

const portfolioSchema = new Schema(
    {
        slug: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        title: {
            type: String,
            required: true,
        },
        subtitle: {
            type: String,
            default: "",
        },
        description: {
            type: String,
            default: "",
        },
        image: {
            type: String,
            default: "",
        },
        tags: {
            type: [String],
            default: [],
        },
        processSteps: {
            type: [processStepSchema],
            default: [],
        },
        images: {
            type: [String],
            default: [],
        },
        problem: {
            type: [String],
            default: [],
        },
        solution: {
            type: [String],
            default: [],
        },
        processImages: {
            type: [String],
            default: [],
        },
        demoUrl: {
            type: String,
            default: null,
        }
    },
    {
        timestamps: true,
        virtuals: true,
        toJSON: {
            virtuals: true,
            getters: true,
        },
        toObject: {
            virtuals: true,
            getters: true,
        },
    }
);

const portfolioModel = model("portfolio", portfolioSchema);

export default portfolioModel;
