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

// --- SCHEMAS (Hierarchy & Operations) ---
const User = mongoose.model('User', new mongoose.Schema({
    id: String, name: String, email: { type: String, unique: true }, 
    password: String, role: String, divisionId: String, token: String
}));

const Division = mongoose.model('Division', new mongoose.Schema({ id: String, name: String, managerId: String }));

const Worker = mongoose.model('Worker', new mongoose.Schema({ 
    id: String, name: String, headmanId: String, divisionId: String, category: String 
}));

const Checkpoint = mongoose.model('Checkpoint', new mongoose.Schema({ id: String, name: String, qrCode: String, latitude: Number, longitude: Number }));

const PatrolLog = mongoose.model('PatrolLog', new mongoose.Schema({ 
    id: String, checkpointId: String, guardId: String, timestamp: Date, latitude: Number, longitude: Number 
}));

const PalmBlock = mongoose.model('PalmBlock', new mongoose.Schema({ id: String, name: String, area: Number, treeCount: Number, divisionId: String }));

const CheckRoll = mongoose.model('CheckRoll', new mongoose.Schema({
    id: String, workerId: String, supervisorId: String, date: Date, checkIn: Date, checkOut: Date, dailyRateAtTime: Number, isCompleted: Boolean
}));

const GlobalSettings = mongoose.model('GlobalSettings', new mongoose.Schema({ id: String, dailyWorkRate: Number }));

const Truck = mongoose.model('Truck', new mongoose.Schema({ id: String, plateNumber: String, driverName: String }));

const LogisticsRecord = mongoose.model('LogisticsRecord', new mongoose.Schema({
    id: String, truckId: String, grossWeight: Number, tareWeight: Number, netWeight: Number, timestamp: Date, securityToken: String
}));

// --- SEED DATA ---
async function seedData() {
    try {
        const adminExists = await User.findOne({ email: 'admin@palmcore.com' });
        if (!adminExists) {
            await User.create({ id: "1", name: "System Admin", email: "admin@palmcore.com", password: "password", role: "Admin" });
        }
        const settings = await GlobalSettings.findOne({ id: 'estate_config' });
        if (!settings) await GlobalSettings.create({ id: 'estate_config', dailyWorkRate: 3500 });
    } catch (e) { console.error("Seed error:", e.message); }
}

// --- ROUTES ---

// 1. SETTINGS & ADMIN
app.get('/admin/settings/rate', async (req, res) => res.json(await GlobalSettings.findOne({ id: 'estate_config' }) || { dailyWorkRate: 0 }));
app.post('/admin/settings/rate', async (req, res) => {
    await GlobalSettings.findOneAndUpdate({ id: 'estate_config' }, { dailyWorkRate: req.body.rate }, { upsert: true });
    res.json({ message: "OK" });
});

// 2. AUTH & STAFF
app.post('/auth/login', async (req, res) => {
    const user = await User.findOne({ email: req.body.email, password: req.body.password });
    if (user) res.json(user); else res.status(401).json({ message: "Invalid credentials" });
});
app.get('/auth/users', async (req, res) => res.json(await User.find({}, '-password')));
app.post('/auth/users', async (req, res) => { try { await User.create(req.body); res.status(201).send(); } catch (e) { res.status(400).send(); } });
app.patch('/auth/users/:id/password', async (req, res) => { await User.updateOne({ id: req.params.id }, { password: req.body.newPassword }); res.send(); });

// 3. WORKFORCE & DIVISIONS
app.get('/workforce/workers', async (req, res) => res.json(await Worker.find()));
app.post('/workforce/workers', async (req, res) => { await Worker.create(req.body); res.status(201).send(); });
app.get('/workforce/divisions', async (req, res) => res.json(await Division.find()));
app.post('/workforce/divisions', async (req, res) => { await Division.create(req.body); res.status(201).send(); });

app.post('/workforce/checkroll/mark', async (req, res) => {
    const settings = await GlobalSettings.findOne({ id: 'estate_config' });
    const roll = await CheckRoll.findOneAndUpdate(
        { id: req.body.id }, 
        { ...req.body, dailyRateAtTime: settings.dailyWorkRate, date: new Date() }, 
        { upsert: true, new: true }
    );
    res.json(roll);
});

// 4. SECURITY (PALMSHIELD)
app.get('/security/checkpoints', async (req, res) => res.json(await Checkpoint.find()));
app.post('/security/patrol-logs', async (req, res) => { await PatrolLog.insertMany(req.body); res.status(201).send(); });

// 5. AGRITECH & LOGISTICS
app.get('/agritech/blocks', async (req, res) => res.json(await PalmBlock.find()));
app.post('/logistics/records', async (req, res) => { await LogisticsRecord.create(req.body); res.status(201).send(); });

// 6. REPORTING
app.get('/admin/reports/monthly', async (req, res) => {
    const production = await PatrolLog.find(); 
    res.json({ production });
});

app.get('/admin/reports/worker-logs', async (req, res) => {
    const logs = await CheckRoll.find({ workerId: req.query.workerId });
    res.json(logs);
});

app.get('/', (req, res) => res.send("PalmCore Master API is Live"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    connectDB();
});
