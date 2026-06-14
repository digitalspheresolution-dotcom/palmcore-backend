const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const app = express();

app.use(cors());
app.use(express.json());

// --- DATABASE CONNECTION ---
// Make sure MONGODB_URI is set in your Render.com Environment Variables
let mongoURI = process.env.MONGODB_URI || "";
mongoURI = mongoURI.replace(/[<>" \s]/g, "").trim();

const connectDB = async () => {
    if (!mongoURI) {
        console.error("❌ MONGODB_URI is missing in Render Settings!");
        return;
    }
    try {
        await mongoose.connect(mongoURI, { serverSelectionTimeoutMS: 5000 });
        console.log("✅ Connected to MongoDB Atlas");
        await seedData();
    } catch (err) {
        console.error("❌ MongoDB connection error:", err.message);
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

const PalmBlock = mongoose.model('PalmBlock', new mongoose.Schema({
    id: String, name: String, area: Number, treeCount: Number, plantedDate: Date
}));

const HarvestAssignment = mongoose.model('HarvestAssignment', new mongoose.Schema({
    id: String, blockId: String, supervisorId: String, date: Date, status: String
}));

const Truck = mongoose.model('Truck', new mongoose.Schema({
    id: String, plateNumber: String, driverName: String, capacity: Number
}));

const EvacuationPoint = mongoose.model('EvacuationPoint', new mongoose.Schema({
    id: String, blockId: String, estimatedQuantity: Number, harvestedAt: Date, latitude: Number, longitude: Number
}));

const LogisticsRecord = mongoose.model('LogisticsRecord', new mongoose.Schema({
    id: String, truckId: String, grossWeight: Number, tareWeight: Number, netWeight: Number, 
    timestamp: Date, destination: String, securityToken: String
}));

const Incident = mongoose.model('Incident', new mongoose.Schema({
    id: String, type: String, description: String, timestamp: Date, latitude: Number, longitude: Number
}));

// --- SEED DATA (Creates defaults if database is empty) ---
async function seedData() {
    try {
        const adminExists = await User.findOne({ email: 'admin@palmcore.com' });
        if (!adminExists) {
            await User.create({ id: "1", name: "System Admin", email: "admin@palmcore.com", password: "password", role: "Admin", token: "init-token" });
            console.log("🚀 Seed: Admin account created.");
        }
        
        const cpExists = await Checkpoint.findOne({ id: 'CP1' });
        if (!cpExists) {
            await Checkpoint.create({ id: "CP1", name: "Main Gate", qrCode: "GATE_001", latitude: 5.1, longitude: 8.5 });
            console.log("🚀 Seed: Default checkpoints created.");
        }
    } catch (e) { console.error("Seed error:", e.message); }
}

// --- ROUTES ---

// 1. AUTH & USER MANAGEMENT
app.post('/auth/login', async (req, res) => {
    const user = await User.findOne({ email: req.body.email, password: req.body.password });
    if (user) res.json(user);
    else res.status(401).json({ message: "Invalid credentials" });
});

app.get('/auth/users', async (req, res) => {
    const users = await User.find({}, '-password');
    res.json(users);
});

app.post('/auth/users', async (req, res) => {
    try { await User.create(req.body); res.status(201).json({ message: "User created" }); }
    catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/auth/users/:id', async (req, res) => {
    await User.deleteOne({ id: req.params.id });
    res.json({ message: "Deleted" });
});

// 2. SECURITY (PALMSHIELD)
app.get('/security/checkpoints', async (req, res) => res.json(await Checkpoint.find()));
app.post('/security/checkpoints', async (req, res) => {
    await Checkpoint.create(req.body);
    res.status(201).json({ message: "OK" });
});
app.post('/security/patrol-logs', async (req, res) => {
    await PatrolLog.insertMany(req.body);
    res.status(201).json({ message: "Synced" });
});
app.post('/security/incidents', async (req, res) => {
    await Incident.insertMany(req.body);
    res.status(201).json({ message: "Logged" });
});

// 3. AGRITECH (YIELDMAP)
app.get('/agritech/blocks', async (req, res) => res.json(await PalmBlock.find()));
app.post('/agritech/blocks', async (req, res) => {
    await PalmBlock.create(req.body);
    res.status(201).json({ message: "OK" });
});
app.get('/agritech/assignments', async (req, res) => res.json(await HarvestAssignment.find()));
app.post('/agritech/yield-records', async (req, res) => {
    // Logic to update evacuation points could go here
    res.status(201).json({ message: "Yield logged" });
});

// 4. LOGISTICS (PALMLOGISTICS)
app.get('/logistics/trucks', async (req, res) => res.json(await Truck.find()));
app.get('/logistics/evacuation-points', async (req, res) => res.json(await EvacuationPoint.find()));
app.post('/logistics/records', async (req, res) => {
    await LogisticsRecord.create(req.body);
    res.status(201).json({ message: "Waybill generated" });
});

// Health Check
app.get('/', (req, res) => res.send("PalmCore API is Live & Persistent"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    connectDB();
});
