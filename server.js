const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const app = express();

app.use(cors());
app.use(express.json());

// --- MONGODB CONNECTION ---
// On Render, we will set this in Environment Variables
const mongoURI = process.env.MONGODB_URI || "PASTE_YOUR_CONNECTION_STRING_HERE";

mongoose.connect(mongoURI)
    .then(() => console.log("Connected to MongoDB"))
    .catch(err => console.error("MongoDB connection error:", err));

// --- SCHEMAS ---
const UserSchema = new mongoose.Schema({
    id: String, name: String, email: { type: String, unique: true }, 
    password: String, role: String, token: String
});
const User = mongoose.model('User', UserSchema);

const CheckpointSchema = new mongoose.Schema({ id: String, name: String, qrCode: String, latitude: Number, longitude: Number });
const Checkpoint = mongoose.model('Checkpoint', CheckpointSchema);

const PatrolLogSchema = new mongoose.Schema({ id: String, checkpointId: String, guardId: String, timestamp: Date, latitude: Number, longitude: Number });
const PatrolLog = mongoose.model('PatrolLog', PatrolLogSchema);

// --- SEED ADMIN (Ensures you can always log in) ---
async function seedAdmin() {
    const adminExists = await User.findOne({ email: 'admin@palmcore.com' });
    if (!adminExists) {
        await User.create({
            id: "1", name: "System Admin", email: "admin@palmcore.com", 
            password: "password", role: "Admin", token: "init-token"
        });
        console.log("Seed: Admin account created.");
    }
}
seedAdmin();

// --- ROUTES ---

// Auth: Login
app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email, password });
    if (user) res.json(user);
    else res.status(401).json({ message: "Invalid credentials" });
});

// Auth: Create User (Admin Power)
app.post('/auth/users', async (req, res) => {
    try {
        await User.create(req.body);
        res.status(201).json({ message: "User created" });
    } catch (e) { res.status(400).json({ error: e.message }); }
});

// Security: Get Checkpoints
app.get('/security/checkpoints', async (req, res) => {
    const list = await Checkpoint.find();
    res.json(list);
});

// Security: Receive Logs
app.post('/security/patrol-logs', async (req, res) => {
    await PatrolLog.insertMany(req.body);
    res.status(201).json({ message: "Logs saved" });
});

// Health Check
app.get('/', (req, res) => res.send("PalmCore API is Live & Persistent"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));