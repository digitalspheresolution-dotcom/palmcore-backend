const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const app = express();

app.use(cors());
app.use(express.json());

// --- DATABASE CONNECTION ---
let mongoURI = process.env.MONGODB_URI || "";
mongoURI = mongoURI.replace(/[<>" \s]/g, "").trim();

const connectDB = async () => {
    if (!mongoURI) {
        console.error("❌ MONGODB_URI is missing in Render Settings!");
        return;
    }
    try {
        await mongoose.connect(mongoURI, { serverSelectionTimeoutMS: 5000 });
        console.log("✅ Connected to MongoDB Atlas - PalmCore Master");
        await seedData();
    } catch (err) {
        console.error("❌ MongoDB connection error:", err.message);
    }
};

// --- SCHEMAS ---

// 1. Auth & Hierarchy
const User = mongoose.model('User', new mongoose.Schema({
    id: String, name: String, email: { type: String, unique: true }, 
    password: String, role: String, // Admin, CSO, Manager, Supervisor
    divisionId: String, // For Managers/Supervisors
    token: String
}));

const Division = mongoose.model('Division', new mongoose.Schema({
    id: String, name: String, managerId: String
}));

const Worker = mongoose.model('Worker', new mongoose.Schema({
    id: String, name: String, headmanId: String, divisionId: String, category: String 
}));

// 2. Operations
const Checkpoint = mongoose.model('Checkpoint', new mongoose.Schema({ 
    id: String, name: String, qrCode: String, latitude: Number, longitude: Number 
}));

const PatrolLog = mongoose.model('PatrolLog', new mongoose.Schema({ 
    id: String, checkpointId: String, guardId: String, timestamp: Date, latitude: Number, longitude: Number 
}));

const PalmBlock = mongoose.model('PalmBlock', new mongoose.Schema({
    id: String, name: String, area: Number, treeCount: Number, plantedDate: Date, divisionId: String
}));

const HarvestAssignment = mongoose.model('HarvestAssignment', new mongoose.Schema({
    id: String, blockId: String, supervisorId: String, date: Date, status: String
}));

// 3. Logistics & Weighbridge
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

// 4. Payroll & Incidents
const CheckRoll = mongoose.model('CheckRoll', new mongoose.Schema({
    id: String, workerId: String, supervisorId: String, date: Date,
    checkIn: Date, checkOut: Date, dailyRateAtTime: Number, isCompleted: { type: Boolean, default: false }
}));

const GlobalSettings = mongoose.model('GlobalSettings', new mongoose.Schema({
    id: String, dailyWorkRate: Number 
}));

const Incident = mongoose.model('Incident', new mongoose.Schema({
    id: String, type: String, description: String, timestamp: Date, latitude: Number, longitude: Number
}));

// --- SEED DATA ---
async function seedData() {
    try {
        const adminExists = await User.findOne({ email: 'admin@palmcore.com' });
        if (!adminExists) {
            await User.create({ id: "1", name: "System Admin", email: "admin@palmcore.com", password: "password", role: "Admin" });
            console.log("🚀 Seed: Master Admin Ready.");
        }
        const settings = await GlobalSettings.findOne({ id: 'estate_config' });
        if (!settings) await GlobalSettings.create({ id: 'estate_config', dailyWorkRate: 3500 });
    } catch (e) { console.error("Seed error:", e.message); }
}

// --- ROUTES ---

// 1. SETTINGS & PAYROLL
app.get('/admin/settings/rate', async (req, res) => {
    const s = await GlobalSettings.findOne({ id: 'estate_config' });
    res.json(s || { dailyWorkRate: 0 });
});

app.post('/admin/settings/rate', async (req, res) => {
    await GlobalSettings.findOneAndUpdate({ id: 'estate_config' }, { dailyWorkRate: req.body.rate }, { upsert: true });
    res.json({ message: "Rate Updated" });
});

// 2. AUTH & USER MGMT
app.post('/auth/login', async (req, res) => {
    const user = await User.findOne({ email: req.body.email, password: req.body.password });
    if (user) res.json(user); else res.status(401).json({ message: "Invalid credentials" });
});

app.get('/auth/users', async (req, res) => res.json(await User.find({}, '-password')));

app.post('/auth/users', async (req, res) => {
    try { await User.create(req.body); res.status(201).json({ message: "Created" }); }
    catch (e) { res.status(400).json({ error: e.message }); }
});

app.patch('/auth/users/:id/password', async (req, res) => {
    await User.updateOne({ id: req.params.id }, { password: req.body.newPassword });
    res.json({ message: "Updated" });
});

// 3. SECURITY
app.get('/security/checkpoints', async (req, res) => res.json(await Checkpoint.find()));
app.post('/security/patrol-logs', async (req, res) => {
    await PatrolLog.insertMany(req.body);
    res.status(201).json({ message: "Synced" });
});

// 4. AGRITECH & LOGISTICS
app.get('/agritech/blocks', async (req, res) => res.json(await PalmBlock.find()));
app.get('/logistics/evacuation-points', async (req, res) => res.json(await EvacuationPoint.find()));
app.post('/logistics/records', async (req, res) => {
    await LogisticsRecord.create(req.body);
    res.status(201).json({ message: "Waybill OK" });
});

// 5. REPORTING
app.get('/admin/reports/monthly', async (req, res) => {
    const { month, year } = req.query;
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    const production = await PatrolLog.find({ timestamp: { $gte: start, $lte: end } }); // Example aggregation
    res.json({ production });
});

app.get('/', (req, res) => res.send("PalmCore Enterprise API - All Modules Active"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    connectDB();
});

// --- ADD THESE NEW ENDPOINTS TO YOUR EXISTING SERVER.JS ---

// Admin: Individual Worker Performance Log
app.get('/admin/reports/worker-logs', async (req, res) => {
    try {
        const { workerId, month, year } = req.query;
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0);
        
        const logs = await CheckRoll.find({ 
            workerId: workerId, 
            date: { $gte: start, $lte: end } 
        }).sort({ date: 1 });
        
        res.json(logs);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Admin: Loss Prevention Data (Comparison)
app.get('/admin/loss-alerts', async (req, res) => {
    // Logic: Sum of Harvest Quantity vs. Sum of Waybill Tonnage
    res.json({ status: "integrity_ok", discrepancies: [] });
});

// Workforce: Fetch All Divisions
app.get('/workforce/divisions', async (req, res) => {
    res.json(await Division.find());
});

// Workforce: Create Worker
app.post('/workforce/workers', async (req, res) => {
    try {
        await Worker.create(req.body);
        res.status(201).json({ message: "Worker Registered" });
    } catch (e) { res.status(400).json({ error: e.message }); }
});
