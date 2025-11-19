import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import fs from 'fs';
import { promisify } from 'util';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 2000;

// Create HTTP server for Socket.IO
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://localhost:5173",
      "https://jbmmsi1.netlify.app",
      "https://jbmmsi.com"
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

// ES module fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Enhanced CORS configuration
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://localhost:5173", 
    "https://jbmmsi1.netlify.app",
    "https://jbmmsi.com"
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Environment variable validation
const requiredEnvVars = ['MONGODB_ATLAS_URI'];
requiredEnvVars.forEach(envVar => {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
});

// Connect to MongoDB with jbmmsi database
console.log('🔗 Connecting to MongoDB database: jbmmsi');
mongoose.connect(process.env.MONGODB_ATLAS_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB Atlas - Database: jbmmsi'))
.catch(error => {
  console.error('❌ MongoDB connection error:', error);
  process.exit(1);
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('📊 MongoDB database connection established - jbmmsi');
});



// ========== SCHEMAS ==========

// Define schema for inquiries
const inquirySchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters long'],
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: { 
    type: String, 
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    trim: true,
    match: [/^[\+]?[1-9][\d]{0,15}$/, 'Please enter a valid phone number']
  },
  program: { 
    type: String, 
    required: [true, 'Program is required'],
    trim: true
  },
  grade: { 
    type: String, 
    required: [true, 'Grade is required'],
    trim: true
  },
  message: { 
    type: String, 
    required: [true, 'Message is required'],
    trim: true,
    minlength: [10, 'Message must be at least 10 characters long'],
    maxlength: [1000, 'Message cannot exceed 1000 characters']
  },
  status: {
    type: String,
    enum: ['new', 'contacted', 'resolved'],
    default: 'new'
  },
  timestamp: { 
    type: Date, 
    default: Date.now 
  }
});

const Inquiry = mongoose.model('Inquiry', inquirySchema);

// Define schema for announcements
const announcementSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  date: { 
    type: String, 
    required: [true, 'Date is required'] 
  },
  description: { 
    type: String, 
    required: [true, 'Description is required'],
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  image: { 
    type: String, 
    required: [true, 'Image is required'] 
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

const Announcement = mongoose.model('Announcement', announcementSchema);

// Define schema for schools gallery
const schoolSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'School name is required'],
    trim: true,
    maxlength: [100, 'School name cannot exceed 100 characters']
  },
  imageUrl: { 
    type: String, 
    required: [true, 'Image URL is required'] 
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

const School = mongoose.model('School', schoolSchema);

// Define schema for reviews
const reviewSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  rating: { 
    type: Number, 
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5']
  },
  comment: { 
    type: String, 
    required: [true, 'Comment is required'],
    trim: true,
    minlength: [10, 'Comment must be at least 10 characters long'],
    maxlength: [500, 'Comment cannot exceed 500 characters']
  },
  date: { 
    type: String, 
    required: true 
  },
  isApproved: {
    type: Boolean,
    default: true
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

const Review = mongoose.model('Review', reviewSchema);

// ========== UTILITY FUNCTIONS ==========

// Helper function to get base URL
const getBaseUrl = (req) => {
  return process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
};

// Helper function to format image URL
const formatImageUrl = (req, filename) => {
  return `${getBaseUrl(req)}/uploads/${filename}`;
};

// Helper function for consistent API responses
const sendResponse = (res, status, success, message, data = null) => {
  const response = { success, message };
  if (data) response.data = data;
  return res.status(status).json(response);
};

// ========== DATABASE STATUS ROUTES ==========

// Get database status and collections
app.get('/api/database-status', async (req, res) => {
  try {
    const collections = await db.db.listCollections().toArray();
    const collectionNames = collections.map(col => col.name);
    
    const stats = {
      database: db.db.databaseName,
      collections: collectionNames,
      counts: {}
    };
    
    // Get document counts for each collection
    for (let collectionName of collectionNames) {
      stats.counts[collectionName] = await db.db.collection(collectionName).countDocuments();
    }
    
    sendResponse(res, 200, true, 'Database status retrieved', stats);
  } catch (error) {
    console.error('Error checking database:', error);
    sendResponse(res, 500, false, 'Error checking database status');
  }
});

// Get all data counts
app.get('/api/stats', async (req, res) => {
  try {
    const stats = {
      inquiries: await Inquiry.countDocuments(),
      announcements: await Announcement.countDocuments(),
      schools: await School.countDocuments(),
      reviews: await Review.countDocuments(),
      activeAnnouncements: await Announcement.countDocuments({ isActive: true }),
      approvedReviews: await Review.countDocuments({ isApproved: true }),
      activeSchools: await School.countDocuments({ isActive: true })
    };
    
    sendResponse(res, 200, true, 'Database statistics', stats);
  } catch (error) {
    console.error('Error getting stats:', error);
    sendResponse(res, 500, false, 'Error getting statistics');
  }
});

// ========== MONGODB CHANGE STREAMS ==========

async function setupChangeStreams() {
  try {
    console.log('🔍 Setting up MongoDB Change Streams for jbmmsi database...');

    const announcementsChangeStream = Announcement.watch();
    announcementsChangeStream.on('change', (change) => {
      console.log('📢 MongoDB Change detected in announcements:', change.operationType);
      
      switch (change.operationType) {
        case 'insert':
          const newAnnouncement = change.fullDocument;
          io.emit('announcement_created', newAnnouncement);
          break;
        case 'update':
          Announcement.findById(change.documentKey._id)
            .then(updatedAnnouncement => {
              if (updatedAnnouncement) {
                io.emit('announcement_updated', updatedAnnouncement);
              }
            });
          break;
        case 'delete':
          io.emit('announcement_deleted', { id: change.documentKey._id });
          break;
      }
    });

    const schoolsChangeStream = School.watch();
    schoolsChangeStream.on('change', (change) => {
      console.log('🏫 MongoDB Change detected in schools:', change.operationType);
      
      switch (change.operationType) {
        case 'insert':
          const newSchool = change.fullDocument;
          io.emit('school_created', newSchool);
          break;
        case 'update':
          School.findById(change.documentKey._id)
            .then(updatedSchool => {
              if (updatedSchool) {
                io.emit('school_updated', updatedSchool);
              }
            });
          break;
        case 'delete':
          io.emit('school_deleted', { id: change.documentKey._id });
          break;
      }
    });

    const inquiriesChangeStream = Inquiry.watch();
    inquiriesChangeStream.on('change', (change) => {
      console.log('📧 MongoDB Change detected in inquiries:', change.operationType);
      
      if (change.operationType === 'insert') {
        io.emit('inquiry_created', change.fullDocument);
      }
    });

    const reviewsChangeStream = Review.watch();
    reviewsChangeStream.on('change', (change) => {
      console.log('⭐ MongoDB Change detected in reviews:', change.operationType);
      
      switch (change.operationType) {
        case 'insert':
          io.emit('review_created', change.fullDocument);
          break;
        case 'update':
          Review.findById(change.documentKey._id)
            .then(updatedReview => {
              if (updatedReview) {
                io.emit('review_updated', updatedReview);
              }
            });
          break;
        case 'delete':
          io.emit('review_deleted', { id: change.documentKey._id });
          break;
      }
    });

    console.log('✅ All MongoDB Change Streams activated for jbmmsi database');
  } catch (error) {
    console.error('❌ Error setting up Change Streams:', error);
  }
}

// Start change streams after MongoDB connection is established
db.once('open', () => {
  console.log('🗄️ Database jbmmsi is ready - setting up change streams');
  setupChangeStreams();
});

// ========== WEBSOCKET SETUP ==========

io.on('connection', (socket) => {
  console.log('🔌 New client connected:', socket.id);

  // Send initial connection confirmation
  socket.emit('connected', { 
    message: 'Connected to JBMMSI real-time server', 
    timestamp: new Date(),
    clientId: socket.id,
    database: 'jbmmsi'
  });

  // Join room for specific features
  socket.on('join_announcements', () => {
    socket.join('announcements');
    console.log(`Client ${socket.id} joined announcements room`);
  });

  socket.on('join_schools', () => {
    socket.join('schools');
    console.log(`Client ${socket.id} joined schools room`);
  });

  socket.on('join_reviews', () => {
    socket.join('reviews');
    console.log(`Client ${socket.id} joined reviews room`);
  });

  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });
});

// Function to broadcast events to all clients
function broadcastToClients(event, data) {
  io.emit(event, data);
  console.log(`📢 Broadcasted ${event} to ${io.engine.clientsCount} clients`);
}

// ========== INQUIRIES ROUTES ==========

// Get all inquiries (for admin dashboard)
app.get('/api/inquiries', async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const query = status ? { status } : {};
    
    const inquiries = await Inquiry.find(query)
      .sort({ timestamp: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Inquiry.countDocuments(query);
    
    sendResponse(res, 200, true, 'Inquiries fetched successfully', {
      inquiries,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error fetching inquiries:', error);
    sendResponse(res, 500, false, 'Error fetching inquiries');
  }
});

// Update inquiry status (for admin)
app.patch('/api/inquiries/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const inquiry = await Inquiry.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    
    if (!inquiry) {
      return sendResponse(res, 404, false, 'Inquiry not found');
    }
    
    sendResponse(res, 200, true, 'Inquiry status updated successfully', inquiry);
  } catch (error) {
    console.error('Error updating inquiry status:', error);
    sendResponse(res, 500, false, 'Error updating inquiry status');
  }
});

// Submit new inquiry
app.post('/api/inquiries', async (req, res) => {
  try {
    console.log('Received inquiry:', req.body);
    
    const inquiry = new Inquiry({
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      program: req.body.program,
      grade: req.body.grade,
      message: req.body.message,
      timestamp: req.body.timestamp || new Date()
    });
    
    await inquiry.save();
    console.log('Inquiry saved successfully to jbmmsi database');

    broadcastToClients('inquiry_created', inquiry);
    
    sendResponse(res, 201, true, 'Inquiry submitted successfully! We will contact you soon.', {
      id: inquiry._id
    });
  } catch (error) {
    console.error('Error saving inquiry:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return sendResponse(res, 400, false, `Validation error: ${errors.join(', ')}`);
    }
    
    sendResponse(res, 500, false, 'Error submitting inquiry. Please try again.');
  }
});

// ========== ANNOUNCEMENTS ROUTES ==========

// ========== ANNOUNCEMENTS ROUTES ==========

// Get all announcements with pagination (Admin)
app.get('/api/announcements', async (req, res) => {
  try {
    const { page = 1, limit = 10, active } = req.query;
    const query = active !== undefined ? { isActive: active === 'true' } : {};
    
    const announcements = await Announcement.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    // Format announcements
    const formattedAnnouncements = announcements.map(announcement => ({
      ...announcement.toObject()
    }));
    
    const total = await Announcement.countDocuments(query);
    
    sendResponse(res, 200, true, 'Announcements fetched successfully', {
      announcements: formattedAnnouncements,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error fetching announcements:', error);
    sendResponse(res, 500, false, 'Error fetching announcements');
  }
});

// FIXED: Get active announcements (no uploads folder dependency)
app.get('/api/announcements/active', async (req, res) => {
  try {
    console.log('📢 Fetching active announcements...');
    
    // Use native MongoDB driver to access the same collection as mobile app
    const db = mongoose.connection.db;
    const announcementsCollection = db.collection('announcements');
    
    // Use the same query as mobile app
    let query = {
      status: { $ne: "inactive" }
    };

    const announcements = await announcementsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .limit(6)
      .toArray();

    console.log(`✅ Found ${announcements.length} announcements from database`);

    // Format announcements to be compatible with both mobile and website
    const formattedAnnouncements = announcements.map(announcement => {
      // Use mobile app field names as primary, with fallbacks
      const title = announcement.Title || announcement.title || "Announcement";
      const description = announcement.Description || announcement.description || "";
      let image = announcement.Photo || announcement.image || "";
      const date = announcement.Date || announcement.date || 
                   announcement.createdAt ? announcement.createdAt.toISOString() : new Date().toISOString();

      // Process image - only handle base64 data, ignore file paths
      if (image) {
        // If it's base64 data, use as is
        if (image.startsWith('data:image') || image.startsWith('iVBORw')) {
          console.log(`📸 Using base64 image for: ${title}`);
          // Ensure base64 has proper prefix
          if (image.startsWith('iVBORw') && image.length > 1000) {
            image = `data:image/png;base64,${image}`;
          }
        } 
        // If it's a filename or URL, check if it's a valid image URL
        else if (image.startsWith('http')) {
          // Keep external URLs as is
          console.log(`🌐 Using external image URL for: ${title}`);
        }
        // If it's just a filename (no uploads folder), use placeholder
        else {
          console.log(`❌ Filename without uploads folder: ${image}, using placeholder`);
          image = getPlaceholderUrl(req);
        }
      } else {
        image = getPlaceholderUrl(req);
      }

      return {
        // Mobile app fields
        _id: announcement._id?.toString() || `announcement-${Date.now()}`,
        Title: title,
        Description: description,
        Photo: image,
        Date: date,
        sentBy: announcement.sentBy || "Administrator",
        priority: announcement.priority || "medium",
        targetAudience: announcement.targetAudience || "all",
        targetSection: announcement.targetSection || null,
        targetTeacherId: announcement.targetTeacherId || null,
        createdAt: announcement.createdAt || new Date(),
        updatedAt: announcement.updatedAt || new Date(),
        
        // Website fields (compatibility)
        title: title,
        description: description,
        image: image,
        date: date,
        isActive: announcement.isActive !== false
      };
    });

    sendResponse(res, 200, true, 'Announcements fetched successfully', formattedAnnouncements);
  } catch (error) {
    console.error('❌ Error fetching announcements:', error);
    sendResponse(res, 500, false, 'Error fetching announcements');
  }
});

// Unified endpoint that matches mobile app exactly
app.get("/api/getAnnouncements", async (req, res) => {
  try {
    const { lastUpdate, limit = 50 } = req.query;

    console.log("📢 Fetching announcements, lastUpdate:", lastUpdate);

    const db = mongoose.connection.db;
    const announcementsCollection = db.collection("announcements");

    let query = {
      status: { $ne: "inactive" }
    };

    if (lastUpdate) {
      query.updatedAt = { $gt: new Date(parseInt(lastUpdate)) };
    }

    const announcements = await announcementsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .toArray();

    console.log("✅ Found", announcements.length, "announcements from database");

    const formattedAnnouncements = announcements.map(announcement => ({
      _id: announcement._id?.toString() || `announcement-${Date.now()}`,
      Title: announcement.title || announcement.Title || "Announcement",
      Description: announcement.description || announcement.Description || "",
      Photo: announcement.image || announcement.Photo || "",
      Date: announcement.date || announcement.Date || announcement.createdAt ? announcement.createdAt.toISOString() : new Date().toISOString(),
      sentBy: announcement.sentBy || "Administrator",
      priority: announcement.priority || "medium",
      targetAudience: announcement.targetAudience || "all",
      targetSection: announcement.targetSection || null,
      targetTeacherId: announcement.targetTeacherId || null,
      createdAt: announcement.createdAt || new Date(),
      updatedAt: announcement.updatedAt || new Date()
    }));

    // Process image URLs for web
    const webFormattedAnnouncements = formattedAnnouncements.map(announcement => {
      let imageUrl = announcement.Photo;
      
      if (imageUrl) {
        // Handle base64 data
        if (imageUrl.startsWith('data:image') || imageUrl.startsWith('iVBORw')) {
          if (imageUrl.startsWith('iVBORw') && imageUrl.length > 1000) {
            imageUrl = `data:image/png;base64,${imageUrl}`;
          }
        } 
        // Handle external URLs
        else if (imageUrl.startsWith('http')) {
          // Keep external URLs as is
        }
        // Handle filenames (without uploads folder)
        else if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('data:')) {
          console.log(`⚠️ Filename without uploads folder: ${imageUrl}, using placeholder`);
          imageUrl = getPlaceholderUrl(req);
        }
      } else {
        imageUrl = getPlaceholderUrl(req);
      }
      
      return {
        ...announcement,
        image: imageUrl, // Add image field for website
        Photo: imageUrl  // Keep Photo field for mobile
      };
    });

    res.json({ 
      success: true, 
      data: webFormattedAnnouncements,
      lastUpdated: new Date(),
      count: webFormattedAnnouncements.length,
      message: `Found ${webFormattedAnnouncements.length} announcement(s)`
    });

  } catch (err) {
    console.error("❌ Error fetching announcements:", err);
    res.status(500).json({ 
      success: false, 
      message: "Server error fetching announcements.",
      data: []
    });
  }
});

// Create new announcement (accepts base64 image data)
app.post('/api/announcements', async (req, res) => {
  try {
    const { title, date, description, image } = req.body;
    
    if (!image) {
      return sendResponse(res, 400, false, 'Image data is required');
    }
    
    const announcement = new Announcement({
      title,
      date,
      description,
      image // Store base64 data directly
    });
    
    await announcement.save();
    
    const formattedAnnouncement = {
      ...announcement.toObject()
    };
    
    broadcastToClients('announcement_created', formattedAnnouncement);
    
    sendResponse(res, 201, true, 'Announcement created successfully', formattedAnnouncement);
  } catch (error) {
    console.error('Error creating announcement:', error);
    sendResponse(res, 500, false, 'Error creating announcement');
  }
});

// Update announcement (accepts base64 image data)
app.put('/api/announcements/:id', async (req, res) => {
  try {
    const { title, date, description, isActive, image } = req.body;
    const updateData = { 
      title, 
      date, 
      description, 
      isActive,
      updatedAt: new Date()
    };
    
    if (image) {
      updateData.image = image; // Store base64 data directly
    }
    
    const announcement = await Announcement.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );
    
    if (!announcement) {
      return sendResponse(res, 404, false, 'Announcement not found');
    }
    
    const formattedAnnouncement = {
      ...announcement.toObject()
    };
    
    broadcastToClients('announcement_updated', formattedAnnouncement);
    
    sendResponse(res, 200, true, 'Announcement updated successfully', formattedAnnouncement);
  } catch (error) {
    console.error('Error updating announcement:', error);
    sendResponse(res, 500, false, 'Error updating announcement');
  }
});

// Delete announcement
app.delete('/api/announcements/:id', async (req, res) => {
  try {
    const announcement = await Announcement.findByIdAndDelete(req.params.id);
    
    if (!announcement) {
      return sendResponse(res, 404, false, 'Announcement not found');
    }
    
    broadcastToClients('announcement_deleted', { id: req.params.id });
    
    sendResponse(res, 200, true, 'Announcement deleted successfully');
  } catch (error) {
    console.error('Error deleting announcement:', error);
    sendResponse(res, 500, false, 'Error deleting announcement');
  }
});

// Helper function to get placeholder URL
function getPlaceholderUrl(req) {
  const baseUrl = getBaseUrl(req);
  return `${baseUrl}/images/placeholder.jpg`;
}

// Add placeholder image endpoint
app.get('/images/placeholder.jpg', (req, res) => {
  // Simple SVG placeholder
  const svg = `<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#f0f0f0"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" 
          font-family="Arial" font-size="16" fill="#999">No Image Available</text>
  </svg>`;
  
  res.set('Content-Type', 'image/svg+xml');
  res.send(svg);
});

// ========== SCHOOLS ROUTES ==========

// Get all schools
app.get('/api/schools', async (req, res) => {
  try {
    const schools = await School.find().sort({ createdAt: -1 });
    
    const schoolsWithFullUrls = schools.map(school => ({
      ...school.toObject(),
      imageUrl: formatImageUrl(req, school.imageUrl)
    }));
    
    sendResponse(res, 200, true, 'Schools fetched successfully', schoolsWithFullUrls);
  } catch (error) {
    console.error('Error fetching schools:', error);
    sendResponse(res, 500, false, 'Error fetching schools');
  }
});

// Get active schools only (for frontend gallery)
app.get('/api/schools/active', async (req, res) => {
  try {
    const schools = await School.find({ isActive: true }).sort({ createdAt: -1 });
    
    const schoolsWithFullUrls = schools.map(school => ({
      _id: school._id,
      name: school.name,
      imageUrl: formatImageUrl(req, school.imageUrl),
      createdAt: school.createdAt,
      updatedAt: school.updatedAt
    }));
    
    sendResponse(res, 200, true, 'Active schools fetched successfully', schoolsWithFullUrls);
  } catch (error) {
    console.error('Error fetching active schools:', error);
    sendResponse(res, 500, false, 'Error fetching schools');
  }
});

// Get single school
app.get('/api/schools/:id', async (req, res) => {
  try {
    const school = await School.findById(req.params.id);
    
    if (!school) {
      return sendResponse(res, 404, false, 'School not found');
    }
    
    const schoolWithFullUrl = {
      ...school.toObject(),
      imageUrl: formatImageUrl(req, school.imageUrl)
    };
    
    sendResponse(res, 200, true, 'School fetched successfully', schoolWithFullUrl);
  } catch (error) {
    console.error('Error fetching school:', error);
    sendResponse(res, 500, false, 'Error fetching school');
  }
});


// Delete school
app.delete('/api/schools/:id', async (req, res) => {
  try {
    const school = await School.findByIdAndDelete(req.params.id);
    
    if (!school) {
      return sendResponse(res, 404, false, 'School not found');
    }
    
    broadcastToClients('school_deleted', { id: req.params.id });
    
    sendResponse(res, 200, true, 'School deleted successfully');
  } catch (error) {
    console.error('Error deleting school:', error);
    sendResponse(res, 500, false, 'Error deleting school');
  }
});

// ========== REVIEWS ROUTES ==========

// Get all reviews
app.get('/api/reviews', async (req, res) => {
  try {
    const reviews = await Review.find().sort({ createdAt: -1 });
    sendResponse(res, 200, true, 'Reviews fetched successfully', reviews);
  } catch (error) {
    console.error('Error fetching reviews:', error);
    sendResponse(res, 500, false, 'Error fetching reviews');
  }
});

// Get approved reviews only (for frontend display)
app.get('/api/reviews/approved', async (req, res) => {
  try {
    const reviews = await Review.find({ isApproved: true }).sort({ createdAt: -1 }).limit(20);
    
    sendResponse(res, 200, true, 'Approved reviews fetched successfully', {
      reviews,
      averageRating: await getAverageRating(),
      total: reviews.length
    });
  } catch (error) {
    console.error('Error fetching approved reviews:', error);
    sendResponse(res, 500, false, 'Error fetching reviews');
  }
});

// Get average rating
async function getAverageRating() {
  const result = await Review.aggregate([
    { $match: { isApproved: true } },
    { $group: { _id: null, average: { $avg: '$rating' } } }
  ]);
  return result.length > 0 ? Math.round(result[0].average * 10) / 10 : 0;
}

// Get single review
app.get('/api/reviews/:id', async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    
    if (!review) {
      return sendResponse(res, 404, false, 'Review not found');
    }
    
    sendResponse(res, 200, true, 'Review fetched successfully', review);
  } catch (error) {
    console.error('Error fetching review:', error);
    sendResponse(res, 500, false, 'Error fetching review');
  }
});

// Create new review
app.post('/api/reviews', async (req, res) => {
  try {
    const { name, rating, comment, date } = req.body;
    
    const review = new Review({
      name,
      rating,
      comment,
      date
    });
    
    await review.save();
    
    broadcastToClients('review_created', review);
    
    sendResponse(res, 201, true, 'Review submitted successfully', review);
  } catch (error) {
    console.error('Error creating review:', error);
    sendResponse(res, 500, false, 'Error creating review');
  }
});

// Update review
app.put('/api/reviews/:id', async (req, res) => {
  try {
    const { name, rating, comment, date, isApproved } = req.body;
    
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { 
        name, 
        rating, 
        comment, 
        date, 
        isApproved,
        updatedAt: new Date()
      },
      { new: true }
    );
    
    if (!review) {
      return sendResponse(res, 404, false, 'Review not found');
    }
    
    broadcastToClients('review_updated', review);
    
    sendResponse(res, 200, true, 'Review updated successfully', review);
  } catch (error) {
    console.error('Error updating review:', error);
    sendResponse(res, 500, false, 'Error updating review');
  }
});

// Delete review
app.delete('/api/reviews/:id', async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    
    if (!review) {
      return sendResponse(res, 404, false, 'Review not found');
    }
    
    broadcastToClients('review_deleted', { id: req.params.id });
    
    sendResponse(res, 200, true, 'Review deleted successfully');
  } catch (error) {
    console.error('Error deleting review:', error);
    sendResponse(res, 500, false, 'Error deleting review');
  }
});

// ========== GENERAL ROUTES ==========

// Enhanced health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    const stats = {
      inquiries: await Inquiry.countDocuments(),
      announcements: await Announcement.countDocuments(),
      schools: await School.countDocuments(),
      reviews: await Review.countDocuments()
    };
    
    sendResponse(res, 200, true, 'JBMMSI Server is running!', {
      timestamp: new Date(),
      database: {
        name: 'jbmmsi',
        status: dbStatus
      },
      uploads: 'Active',
      websockets: io.engine.clientsCount,
      memory: process.memoryUsage(),
      stats
    });
  } catch (error) {
    sendResponse(res, 500, false, 'Health check failed');
  }
});

// API documentation endpoint
app.get('/api/docs', (req, res) => {
  res.json({
    message: 'JBMMSI Server API - Frontend Ready',
    version: '2.0.0',
    database: 'jbmmsi',
    baseUrl: getBaseUrl(req),
    endpoints: {
      database: {
        'GET /api/database-status': 'Check database collections and counts',
        'GET /api/stats': 'Get data statistics'
      },
      inquiries: {
        'POST /api/inquiries': 'Submit new inquiry',
        'GET /api/inquiries': 'Get all inquiries (Admin)',
        'PATCH /api/inquiries/:id/status': 'Update inquiry status (Admin)'
      },
      announcements: {
        'GET /api/announcements': 'Get all announcements with pagination',
        'GET /api/announcements/active': 'Get active announcements for display',
        'GET /api/announcements/:id': 'Get single announcement',
        'POST /api/announcements': 'Create new announcement (Admin)',
        'PUT /api/announcements/:id': 'Update announcement (Admin)',
        'DELETE /api/announcements/:id': 'Delete announcement (Admin)'
      },
      schools: {
        'GET /api/schools': 'Get all schools',
        'GET /api/schools/active': 'Get active schools for gallery',
        'GET /api/schools/:id': 'Get single school',
        'POST /api/schools': 'Create new school (Admin)',
        'PUT /api/schools/:id': 'Update school (Admin)',
        'DELETE /api/schools/:id': 'Delete school (Admin)'
      },
      reviews: {
        'GET /api/reviews': 'Get all reviews',
        'GET /api/reviews/approved': 'Get approved reviews for display',
        'GET /api/reviews/:id': 'Get single review',
        'POST /api/reviews': 'Create new review',
        'PUT /api/reviews/:id': 'Update review (Admin)',
        'DELETE /api/reviews/:id': 'Delete review (Admin)'
      },
      system: {
        'GET /api/health': 'Server health check',
        'GET /api/docs': 'This documentation'
      }
    },
    features: [
      'Database: jbmmsi',
      'Real-time updates via WebSocket',
      'File upload with validation',
      'CORS enabled for frontend',
      'Pagination support',
      'Input validation',
      'Error handling'
    ]
  });
});

// Add debug endpoint to check announcements
app.get('/api/debug/announcements', async (req, res) => {
  try {
    const allAnnouncements = await Announcement.find({});
    const activeAnnouncements = await Announcement.find({ isActive: true });
    
    const debugInfo = {
      total: allAnnouncements.length,
      active: activeAnnouncements.length,
      allAnnouncements: allAnnouncements.map(a => ({
        _id: a._id,
        title: a.title,
        isActive: a.isActive,
        imageType: a.image ? (a.image.startsWith('data:') ? 'base64' : 'filename') : 'none',
        imageLength: a.image ? a.image.length : 0,
        createdAt: a.createdAt
      })),
      activeAnnouncements: activeAnnouncements.map(a => ({
        _id: a._id,
        title: a.title,
        isActive: a.isActive
      }))
    };
    
    sendResponse(res, 200, true, 'Debug information', debugInfo);
  } catch (error) {
    console.error('Debug error:', error);
    sendResponse(res, 500, false, 'Debug error');
  }
});

// Add uploads test endpoint
app.get('/api/debug/uploads', async (req, res) => {
  try {
    const fs = require('fs').promises;
    const uploadsPath = path.join(__dirname, 'uploads');
    
    try {
      const files = await fs.readdir(uploadsPath);
      const fileStats = await Promise.all(
        files.map(async (file) => {
          const filePath = path.join(uploadsPath, file);
          const stats = await fs.stat(filePath);
          return {
            name: file,
            size: stats.size,
            created: stats.birthtime
          };
        })
      );
      
      sendResponse(res, 200, true, 'Uploads directory check', {
        uploadsPath,
        fileCount: files.length,
        files: fileStats
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        sendResponse(res, 200, true, 'Uploads directory does not exist', {
          uploadsPath,
          fileCount: 0,
          files: []
        });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Uploads test error:', error);
    sendResponse(res, 500, false, 'Error checking uploads directory', {
      error: error.message
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'JBMMSI Server API - Frontend Ready', 
    version: '2.0.0',
    status: 'running',
    database: 'jbmmsi',
    documentation: `${getBaseUrl(req)}/api/docs`
  });
});

// Enhanced error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return sendResponse(res, 400, false, 'File too large. Maximum size is 10MB.');
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return sendResponse(res, 400, false, 'Unexpected field in file upload.');
    }
  }
  
  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map(err => err.message);
    return sendResponse(res, 400, false, `Validation error: ${errors.join(', ')}`);
  }
  
  if (error.name === 'CastError') {
    return sendResponse(res, 400, false, 'Invalid ID format');
  }
  
  console.error('Unhandled error:', error);
  sendResponse(res, 500, false, 'Internal server error');
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  sendResponse(res, 404, false, 'API endpoint not found');
});

// Global unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 JBMMSI Server running on port ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️ Database: jbmmsi`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api/docs`);
  console.log(`🔌 WebSocket server active on port ${PORT}`);
  console.log(`🖼️ Uploads directory: ./uploads/`);
  console.log(`❤️ Health check: http://localhost:${PORT}/api/health`);
});
