const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const app = express();

app.use(cors());
app.use(express.json());

// --- BULLETPROOF DATABASE CONNECTION ---
let mongoURI = process.env.MONGODB_URI || "";

// Remove ALL common mistake characters from the string
mongoURI = mongoURI.replace(/[<>" \s]/g, "").trim();

const connectDB = async () => {
    if (!mongoURI) {
        console.error("❌ MONGODB_URI is missing in Render Environment Variables!");
        return;
    }
    
    // Safety check: Is there more than one @ symbol?
    // A valid string has only ONE @ (the one before the cluster address)
    // UNLESS the password was encoded correctly.
    const atCount = (mongoURI.match(/@/g) || []).length;
    
    // Log the connection attempt safely
    const maskedURI = mongoURI.replace(/:([^@]+)@/, ":****@");
    console.log(`📡 Connectivity: Detected ${atCount} '@' symbols.`);
    console.log(`📡 Attempting to connect to: ${maskedURI}`);

    try {
        // Use a 5-second timeout so we don't hang forever
        await mongoose.connect(mongoURI, { serverSelectionTimeoutMS: 5000 });
        console.log("✅ SUCCESS: Connected to MongoDB");
        await seedData();
    } catch (err) {
        console.error("❌ CONNECTION FAILED:", err.message);
        if (err.message.includes('EBADNAME')) {
            console.error("👉 FIX: Your password contains an '@'. Ensure you used '%40' in Render settings.");
        }
    }
};

// --- SCHEMAS ---
const User = mongoose.model('User', new mongoose.Schema({
    id: String, name: String, email: { type: String, unique: true }, 
    password: String, role: String, token: String
}));

const Checkpoint = mongoose.model('Checkpoint', new mongoose.Schema({ 
    id: String, name: String, qrCode: String, latitude: Number, longitude: Number 
}));

const PatrolLog = mongoose.model('PatrolLog', new mongoose.Schema({ 
    id: String, checkpointId: String, guardId: String, timestamp: Date, latitude: Number, longitude: Number 
}));

// --- SEED DATA ---
async function seedData() {
    try {
        const adminExists = await User.findOne({ email: 'admin@palmcore.com' });
        if (!adminExists) {
            await User.create({ id: "1", name: "System Admin", email: "admin@palmcore.com", password: "password", role: "Admin", token: "init-token" });
            console.log("🚀 Seed: Admin created.");
        }
        
        const cpExists = await Checkpoint.findOne({ id: 'CP1' });
        if (!cpExists) {
            await Checkpoint.create({ id: "CP1", name: "Main Gate", qrCode: "GATE_001", latitude: 5.1, longitude: 8.5 });
            await Checkpoint.create({ id: "CP2", name: "Warehouse B", qrCode: "WH_B_001", latitude: 5.12, longitude: 8.57 });
            console.log("🚀 Seed: Checkpoints created.");
        }
    } catch (e) { console.error("Seed error:", e.message); }
}

// --- ROUTES ---
app.post('/auth/login', async (req, res) => {
    const user = await User.findOne({ email: req.body.email, password: req.body.password });
    if (user) res.json(user);
    else res.status(401).json({ message: "Invalid credentials" });
});

app.post('/auth/users', async (req, res) => {
    try { await User.create(req.body); res.status(201).json({ message: "OK" }); }
    catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/security/checkpoints', async (req, res) => res.json(await Checkpoint.find()));
app.post('/security/patrol-logs', async (req, res) => {
    try { await PatrolLog.insertMany(req.body); res.status(201).json({ message: "Saved" }); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/', (req, res) => res.send("PalmCore API is Live & Persistent"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    connectDB();
});
