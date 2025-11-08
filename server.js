import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Create HTTP server for Socket.IO
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://localhost:5173",
      "https://your-frontend-domain.vercel.app",
      "https://your-frontend-domain.netlify.app"
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
    "https://your-frontend-domain.vercel.app",
    "https://your-frontend-domain.netlify.app"
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Connect to MongoDB with enhanced options
mongoose.connect(process.env.MONGODB_ATLAS_URI || process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB Atlas'))
.catch(error => console.error('❌ MongoDB connection error:', error));

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('📊 MongoDB database connection established');
});

// Enhanced Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const originalName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '-');
    cb(null, uniqueSuffix + '-' + originalName);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Error: Images only (JPEG, JPG, PNG, GIF, WEBP, SVG)!'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // Increased to 10MB limit
  }
});

// Create uploads directory if it doesn't exist
import fs from 'fs';
import { promisify } from 'util';
const mkdir = promisify(fs.mkdir);
const exists = promisify(fs.exists);

async function ensureUploadsDir() {
  try {
    const uploadsExists = await exists('uploads');
    if (!uploadsExists) {
      await mkdir('uploads', { recursive: true });
      console.log('📁 Uploads directory created successfully');
    }
  } catch (error) {
    console.error('❌ Error creating uploads directory:', error);
  }
}

ensureUploadsDir();

// ========== ENHANCED SCHEMAS WITH VALIDATION ==========

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

// Define schema for announcements (unchanged)
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

// Define schema for schools gallery (unchanged)
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

// Define schema for reviews (unchanged)
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

// ========== ENHANCED UTILITY FUNCTIONS ==========

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

// ========== MONGODB CHANGE STREAMS (UNCHANGED) ==========

async function setupChangeStreams() {
  try {
    console.log('🔍 Setting up MongoDB Change Streams...');

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

    console.log('✅ All MongoDB Change Streams activated');
  } catch (error) {
    console.error('❌ Error setting up Change Streams:', error);
  }
}

// Start change streams after MongoDB connection is established
db.once('open', () => {
  console.log('Connected to MongoDB');
  setupChangeStreams();
});

// ========== ENHANCED WEBSOCKET SETUP ==========

io.on('connection', (socket) => {
  console.log('🔌 New client connected:', socket.id);

  // Send initial connection confirmation
  socket.emit('connected', { 
    message: 'Connected to real-time server', 
    timestamp: new Date(),
    clientId: socket.id
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

// ========== ENHANCED INQUIRIES ROUTES ==========

// Get all inquiries (NEW - for admin dashboard)
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

// Update inquiry status (NEW - for admin)
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

// Existing inquiry submission (unchanged)
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
    console.log('Inquiry saved successfully');

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

// ========== ENHANCED ANNOUNCEMENTS ROUTES ==========

// Get all announcements with pagination
app.get('/api/announcements', async (req, res) => {
  try {
    const { page = 1, limit = 10, active } = req.query;
    const query = active !== undefined ? { isActive: active === 'true' } : {};
    
    const announcements = await Announcement.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    // Format image URLs
    const formattedAnnouncements = announcements.map(announcement => ({
      ...announcement.toObject(),
      image: formatImageUrl(req, announcement.image)
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

// Get active announcements only (for frontend display)
app.get('/api/announcements/active', async (req, res) => {
  try {
    const announcements = await Announcement.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(6);
    
    const formattedAnnouncements = announcements.map(announcement => ({
      ...announcement.toObject(),
      image: formatImageUrl(req, announcement.image)
    }));
    
    sendResponse(res, 200, true, 'Active announcements fetched successfully', formattedAnnouncements);
  } catch (error) {
    console.error('Error fetching active announcements:', error);
    sendResponse(res, 500, false, 'Error fetching active announcements');
  }
});

// Rest of your announcements routes remain the same...
// [Keep all your existing announcements routes: GET /:id, POST, PUT, DELETE]

// ========== ENHANCED SCHOOLS ROUTES ==========

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

// Rest of your schools routes remain the same...
// [Keep all your existing schools routes: GET, GET /:id, POST, PUT, DELETE]

// ========== ENHANCED REVIEWS ROUTES ==========

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

// Get average rating (NEW)
async function getAverageRating() {
  const result = await Review.aggregate([
    { $match: { isApproved: true } },
    { $group: { _id: null, average: { $avg: '$rating' } } }
  ]);
  return result.length > 0 ? Math.round(result[0].average * 10) / 10 : 0;
}

// Rest of your reviews routes remain the same...
// [Keep all your existing reviews routes: GET, GET /:id, POST, PUT, DELETE]

// ========== ENHANCED GENERAL ROUTES ==========

// Health check endpoint with more details
app.get('/api/health', async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    const stats = {
      inquiries: await Inquiry.countDocuments(),
      announcements: await Announcement.countDocuments(),
      schools: await School.countDocuments(),
      reviews: await Review.countDocuments()
    };
    
    sendResponse(res, 200, true, 'Server is running!', {
      timestamp: new Date(),
      database: dbStatus,
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
    baseUrl: getBaseUrl(req),
    endpoints: {
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
      'Real-time updates via WebSocket',
      'File upload with validation',
      'CORS enabled for frontend',
      'Pagination support',
      'Input validation',
      'Error handling'
    ]
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'JBMMSI Server API - Frontend Ready', 
    version: '2.0.0',
    status: 'running',
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
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api/docs`);
  console.log(`🔌 WebSocket server active on port ${PORT}`);
  console.log(`🖼️ Uploads directory: ./uploads/`);
});