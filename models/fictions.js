const mongoose = require('mongoose');

// Values allowed for status
const STORY_STATUS = ["in-progress", "completed", "one-shot", "abandoned"];
const READING_STATUS = ["to-read", "reading", "finished"];

const languageSchema = new mongoose.Schema({
    name: { type: String, trim: true, required: true },
    position: Number,
});

const fictionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },
    title: { type: String, trim: true, required: true },
    link: { type: String, trim: true },
    summary: { type: String, trim: true },
    personalNote: { type: String, trim: true },
    author: { type: String, trim: true },
    fandomId: { type: mongoose.Schema.Types.ObjectId, ref: "fandoms", required: true },
    numberOfWords: { type: Number, min: 0 },
    numberOfChapters: { type: Number, min: 0 },
    readingStatus: { type: String, enum: READING_STATUS, required: true },
    storyStatus: { type: String, enum: STORY_STATUS },
    language: { type: languageSchema, required: false },
    lastReadAt: Date,
    image: { type: String, trim: true },
    rate: {
        value: { type: Number, min: 0, max: 5 },
        display: { type: Boolean, default: false },
    },
    lastChapterRead: { type: Number, min: 0, default: 0 },
},
{
    timestamps: true,
});

fictionSchema.index({ userId: 1, fandomId: 1 });

// Search by author, or keyword in title
fictionSchema.index({ userId: 1, author: 1 });
fictionSchema.index({ userId: 1,  title: 1 });

// Search by keyword in either summary or personalNote
fictionSchema.index(
    { summary: "text", personalNote: "text"}, 
    { name: "TextIndex_Content" }
);

// Filter (Tabs)
fictionSchema.index({ readingStatus: 1 });

// Sort
fictionSchema.index({ createdAt: -1 });
fictionSchema.index({ lastReadAt: -1 });
fictionSchema.index({ "rate.value": -1 });

const Fiction = mongoose.model('Fiction', fictionSchema);

module.exports = { Fiction };