const mongoose = require('mongoose');

// Values allowed for status
const STORY_STATUS = ["in-progress", "completed", "one-shot", "abandoned"];
const READING_STATUS = ["to-read", "reading", "finished"];

const langSchema = new mongoose.Schema({
    name: { type: String, trim: true, required: true },
    position: Number,
});

const rateSchema = new mongoose.Schema({
    value: { type: Number, min: 0, max: 5 },
    display: { type: Boolean, default: false },
});

const fictionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },
    title: { type: String, trim: true, required: true },
    link: { type: String, trim: true },
    summary: { type: String, trim: true },
    personalNotes: { type: String, trim: true },
    author: { type: String, trim: true },
    fandomId: { type: mongoose.Schema.Types.ObjectId, ref: "fandoms", required: true },
    numberOfWords: { type: Number, min: 0 },
    numberOfChapters: { type: Number, min: 0 },
    readingStatus: { type: String, enum: READING_STATUS, required: true },
    storyStatus: { type: String, enum: STORY_STATUS },
    lang: langSchema,
    rate: rateSchema,
    lastReadAt: Date,
    image: { type: String, trim: true },
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
fictionSchema.index({  userId: 1, readingStatus: 1 });

// Sort
fictionSchema.index({ userId: 1, createdAt: -1 });
fictionSchema.index({ userId: 1, lastReadAt: -1 });
fictionSchema.index({ userId: 1, "rate.value": -1 });

// Languages management
fictionSchema.index({ userId: 1, "lang.name": 1 });

// GLOBAL COMPOSITE INDEX: All fictions by readingStatus + fandom + sorting by date
fictionSchema.index({ userId: 1, readingStatus: 1, fandomId: 1, lastReadAt: -1 });

const Fiction = mongoose.model('fictions', fictionSchema);

module.exports = Fiction;