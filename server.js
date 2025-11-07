//server.js
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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Create HTTP server for Socket.IO
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Adjust in production
    methods: ["GET", "POST"]
  }
});

// ES module fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Connect to MongoDB - FIXED: Use correct environment variable
mongoose.connect(process.env.MONGODB_ATLAS_URI || process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(error => console.error('Connection error', error));

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    // Create unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Error: Images only!'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
  console.log('Uploads directory created');
}

// ========== SCHEMAS ==========

// Define schema for inquiries
const inquirySchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: String,
  program: { type: String, required: true },
  grade: { type: String, required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const Inquiry = mongoose.model('Inquiry', inquirySchema);

// Define schema for announcements - IMPROVED: Better image handling
const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true },
  date: { type: String, required: true },
  description: { type: String, required: true },
  image: { 
    data: { type: String, required: true },
    contentType: { type: String, required: true }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Announcement = mongoose.model('Announcement', announcementSchema);

// Define schema for schools gallery
const schoolSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  imageUrl: { 
    type: String, 
    required: true 
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
    required: true,
    trim: true
  },
  rating: { 
    type: Number, 
    required: true,
    min: 1,
    max: 5
  },
  comment: { 
    type: String, 
    required: true,
    trim: true
  },
  date: { 
    type: String, 
    required: true 
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

// ========== MONGODB CHANGE STREAMS FOR REAL-TIME UPDATES ==========

async function setupChangeStreams() {
  try {
    console.log('🔍 Setting up MongoDB Change Streams...');

    // Watch announcements collection
    const announcementsChangeStream = Announcement.watch();
    announcementsChangeStream.on('change', (change) => {
      console.log('📢 MongoDB Change detected in announcements:', change.operationType);
      
      switch (change.operationType) {
        case 'insert':
          const newAnnouncement = change.fullDocument;
          let imageUrl = '';
          
          if (newAnnouncement.image && newAnnouncement.image.data) {
            imageUrl = `data:${newAnnouncement.image.contentType};base64,${newAnnouncement.image.data}`;
          }
          
          const newAnnouncementData = {
            ...newAnnouncement,
            imageUrl: imageUrl
          };
          io.emit('announcement_created', newAnnouncementData);
          break;
        
        case 'update':
          Announcement.findById(change.documentKey._id)
            .then(updatedAnnouncement => {
              if (updatedAnnouncement) {
                let imageUrl = '';
                
                if (updatedAnnouncement.image && updatedAnnouncement.image.data) {
                  imageUrl = `data:${updatedAnnouncement.image.contentType};base64,${updatedAnnouncement.image.data}`;
                }
                
                const updatedAnnouncementData = {
                  ...updatedAnnouncement.toObject(),
                  imageUrl: imageUrl
                };
                io.emit('announcement_updated', updatedAnnouncementData);
              }
            });
          break;
        
        case 'delete':
          io.emit('announcement_deleted', { id: change.documentKey._id });
          break;
      }
    });

    // Watch schools collection
    const schoolsChangeStream = School.watch();
    schoolsChangeStream.on('change', (change) => {
      console.log('🏫 MongoDB Change detected in schools:', change.operationType);
      
      switch (change.operationType) {
        case 'insert':
          const newSchool = change.fullDocument;
          // FIXED: Proper URL construction
          const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
          newSchool.imageUrl = `${baseUrl}/uploads/${newSchool.imageUrl}`;
          io.emit('school_created', newSchool);
          break;
        
        case 'update':
          School.findById(change.documentKey._id)
            .then(updatedSchool => {
              if (updatedSchool) {
                const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
                updatedSchool.imageUrl = `${baseUrl}/uploads/${updatedSchool.imageUrl}`;
                io.emit('school_updated', updatedSchool);
              }
            });
          break;
        
        case 'delete':
          io.emit('school_deleted', { id: change.documentKey._id });
          break;
      }
    });

    // Watch inquiries collection
    const inquiriesChangeStream = Inquiry.watch();
    inquiriesChangeStream.on('change', (change) => {
      console.log('📧 MongoDB Change detected in inquiries:', change.operationType);
      
      if (change.operationType === 'insert') {
        io.emit('inquiry_created', change.fullDocument);
      }
    });

    // Watch reviews collection
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

    console.log('✅ All MongoDB Change Streams activated - watching for database changes');
  } catch (error) {
    console.error('❌ Error setting up Change Streams:', error);
  }
}

// Start change streams after MongoDB connection is established
db.once('open', () => {
  console.log('Connected to MongoDB');
  setupChangeStreams();
});

// ========== WEBSOCKET SETUP ==========

io.on('connection', (socket) => {
  console.log('🔌 New client connected:', socket.id);

  socket.emit('connected', { 
    message: 'Connected to real-time server', 
    timestamp: new Date() 
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

// Get all inquiries (for admin)
app.get('/api/inquiries', async (req, res) => {
  try {
    const inquiries = await Inquiry.find().sort({ timestamp: -1 });
    res.json({ 
      success: true, 
      data: inquiries,
      count: inquiries.length 
    });
  } catch (error) {
    console.error('Error fetching inquiries:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching inquiries' 
    });
  }
});

// API endpoint to handle form submissions
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
    
    res.status(201).json({ 
      success: true, 
      message: 'Inquiry saved successfully!',
      id: inquiry._id 
    });
  } catch (error) {
    console.error('Error saving inquiry:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error saving inquiry: ' + error.message 
    });
  }
});

// ========== ANNOUNCEMENTS ROUTES ==========

// Get all announcements
app.get('/api/announcements', async (req, res) => {
  try {
    const announcements = await Announcement.find().sort({ createdAt: -1 });
    
    const announcementsWithImages = announcements.map(announcement => {
      let imageUrl = '';
      
      if (announcement.image && announcement.image.data) {
        imageUrl = `data:${announcement.image.contentType};base64,${announcement.image.data}`;
      }
      
      return {
        _id: announcement._id,
        title: announcement.title,
        date: announcement.date,
        description: announcement.description,
        imageUrl: imageUrl,
        createdAt: announcement.createdAt,
        updatedAt: announcement.updatedAt
      };
    });
    
    res.json({ success: true, data: announcementsWithImages });
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({ success: false, message: 'Error fetching announcements' });
  }
});

// Create new announcement
app.post('/api/announcements', async (req, res) => {
  try {
    const { title, date, description, image } = req.body;
    
    if (!title || !date || !description || !image) {
      return res.status(400).json({ 
        success: false, 
        message: 'Title, date, description, and image are required' 
      });
    }

    let imageData = {};
    
    // Handle base64 image data
    if (typeof image === 'string') {
      // Extract content type from base64 string
      const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid base64 image format' 
        });
      }
      
      imageData = {
        data: matches[2], // The actual base64 data
        contentType: matches[1] // The content type
      };
    } else if (image.data && image.contentType) {
      imageData = image;
    } else {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid image format' 
      });
    }

    const announcement = new Announcement({
      title,
      date,
      description,
      image: imageData
    });

    const savedAnnouncement = await announcement.save();
    console.log('Announcement created successfully:', savedAnnouncement._id);

    // Prepare response data
    const announcementData = {
      ...savedAnnouncement.toObject(),
      imageUrl: `data:${savedAnnouncement.image.contentType};base64,${savedAnnouncement.image.data}`
    };

    broadcastToClients('announcement_created', announcementData);
    
    res.status(201).json({ 
      success: true, 
      message: 'Announcement created successfully!',
      data: announcementData 
    });
  } catch (error) {
    console.error('Error creating announcement:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error creating announcement: ' + error.message 
    });
  }
});

// Update announcement
app.put('/api/announcements/:id', async (req, res) => {
  try {
    const { title, date, description, image } = req.body;
    const updateData = { 
      title, 
      date, 
      description,
      updatedAt: new Date()
    };

    if (image) {
      let imageData = {};
      
      if (typeof image === 'string') {
        const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
          return res.status(400).json({ 
            success: false, 
            message: 'Invalid base64 image format' 
          });
        }
        
        imageData = {
          data: matches[2],
          contentType: matches[1]
        };
      } else if (image.data && image.contentType) {
        imageData = image;
      } else {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid image format' 
        });
      }
      
      updateData.image = imageData;
    }

    const updatedAnnouncement = await Announcement.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedAnnouncement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    console.log('Announcement updated successfully:', updatedAnnouncement._id);

    const announcementData = {
      ...updatedAnnouncement.toObject(),
      imageUrl: `data:${updatedAnnouncement.image.contentType};base64,${updatedAnnouncement.image.data}`
    };

    broadcastToClients('announcement_updated', announcementData);

    res.json({ 
      success: true, 
      message: 'Announcement updated successfully!',
      data: announcementData 
    });
  } catch (error) {
    console.error('Error updating announcement:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating announcement: ' + error.message 
    });
  }
});

// Delete announcement
app.delete('/api/announcements/:id', async (req, res) => {
  try {
    const deletedAnnouncement = await Announcement.findByIdAndDelete(req.params.id);
    
    if (!deletedAnnouncement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    console.log('Announcement deleted successfully:', deletedAnnouncement._id);

    broadcastToClients('announcement_deleted', { id: deletedAnnouncement._id });

    res.json({ 
      success: true, 
      message: 'Announcement deleted successfully',
      data: { id: deletedAnnouncement._id }
    });
  } catch (error) {
    console.error('Error deleting announcement:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error deleting announcement: ' + error.message 
    });
  }
});

// ========== SCHOOLS GALLERY ROUTES ==========

// Get all schools for gallery
app.get('/api/schools', async (req, res) => {
  try {
    const schools = await School.find().sort({ createdAt: -1 });
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    
    const schoolsWithFullUrls = schools.map(school => ({
      _id: school._id,
      name: school.name,
      imageUrl: `${baseUrl}/uploads/${school.imageUrl}`,
      createdAt: school.createdAt,
      updatedAt: school.updatedAt
    }));
    
    res.json({ success: true, data: schoolsWithFullUrls });
  } catch (error) {
    console.error('Error fetching schools:', error);
    res.status(500).json({ success: false, message: 'Error fetching schools' });
  }
});

// Get single school
app.get('/api/schools/:id', async (req, res) => {
  try {
    const school = await School.findById(req.params.id);
    if (!school) {
      return res.status(404).json({ success: false, message: 'School not found' });
    }
    
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const schoolWithFullUrl = {
      _id: school._id,
      name: school.name,
      imageUrl: `${baseUrl}/uploads/${school.imageUrl}`,
      createdAt: school.createdAt,
      updatedAt: school.updatedAt
    };
    
    res.json({ success: true, data: schoolWithFullUrl });
  } catch (error) {
    console.error('Error fetching school:', error);
    res.status(500).json({ success: false, message: 'Error fetching school' });
  }
});

// Create new school (for admin)
app.post('/api/schools', upload.single('image'), async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ 
        success: false, 
        message: 'School name is required' 
      });
    }

    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'Image file is required' 
      });
    }

    const school = new School({
      name: name.trim(),
      imageUrl: req.file.filename
    });

    const savedSchool = await school.save();
    console.log('School created successfully:', savedSchool._id);
    
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const schoolWithFullUrl = {
      _id: savedSchool._id,
      name: savedSchool.name,
      imageUrl: `${baseUrl}/uploads/${savedSchool.imageUrl}`,
      createdAt: savedSchool.createdAt,
      updatedAt: savedSchool.updatedAt
    };

    broadcastToClients('school_created', schoolWithFullUrl);
    
    res.status(201).json({ 
      success: true, 
      message: 'School added successfully!',
      data: schoolWithFullUrl 
    });
  } catch (error) {
    console.error('Error creating school:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error creating school: ' + error.message 
    });
  }
});

// Update school
app.put('/api/schools/:id', upload.single('image'), async (req, res) => {
  try {
    const { name } = req.body;
    const updateData = { 
      name: name.trim(),
      updatedAt: new Date()
    };

    if (req.file) {
      updateData.imageUrl = req.file.filename;
    }

    const updatedSchool = await School.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedSchool) {
      return res.status(404).json({ success: false, message: 'School not found' });
    }

    console.log('School updated successfully:', updatedSchool._id);
    
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const schoolWithFullUrl = {
      _id: updatedSchool._id,
      name: updatedSchool.name,
      imageUrl: `${baseUrl}/uploads/${updatedSchool.imageUrl}`,
      createdAt: updatedSchool.createdAt,
      updatedAt: updatedSchool.updatedAt
    };

    broadcastToClients('school_updated', schoolWithFullUrl);
    
    res.json({ 
      success: true, 
      message: 'School updated successfully!',
      data: schoolWithFullUrl 
    });
  } catch (error) {
    console.error('Error updating school:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating school: ' + error.message 
    });
  }
});

// Delete school
app.delete('/api/schools/:id', async (req, res) => {
  try {
    const deletedSchool = await School.findByIdAndDelete(req.params.id);
    
    if (!deletedSchool) {
      return res.status(404).json({ success: false, message: 'School not found' });
    }

    console.log('School deleted successfully:', deletedSchool._id);

    broadcastToClients('school_deleted', { id: deletedSchool._id });

    res.json({ 
      success: true, 
      message: 'School deleted successfully',
      data: { id: deletedSchool._id }
    });
  } catch (error) {
    console.error('Error deleting school:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error deleting school: ' + error.message 
    });
  }
});

// ========== REVIEWS ROUTES ==========

// Get all reviews
app.get('/api/reviews', async (req, res) => {
  try {
    const reviews = await Review.find().sort({ createdAt: -1 });
    res.json({ 
      success: true, 
      data: reviews,
      count: reviews.length 
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching reviews' 
    });
  }
});

// Get single review
app.get('/api/reviews/:id', async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ 
        success: false, 
        message: 'Review not found' 
      });
    }
    res.json({ success: true, data: review });
  } catch (error) {
    console.error('Error fetching review:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching review' 
    });
  }
});

// Create new review
app.post('/api/reviews', async (req, res) => {
  try {
    const { name, rating, comment } = req.body;
    
    if (!name || !rating || !comment) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name, rating, and comment are required' 
      });
    }

    const review = new Review({
      name: name.trim(),
      rating: parseInt(rating),
      comment: comment.trim(),
      date: new Date().toISOString().split('T')[0]
    });

    const savedReview = await review.save();
    console.log('Review created successfully:', savedReview._id);

    broadcastToClients('review_created', savedReview);
    
    res.status(201).json({ 
      success: true, 
      message: 'Review submitted successfully!',
      data: savedReview 
    });
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error creating review: ' + error.message 
    });
  }
});

// Update review
app.put('/api/reviews/:id', async (req, res) => {
  try {
    const { name, rating, comment } = req.body;
    const updateData = { 
      name: name.trim(),
      rating: parseInt(rating),
      comment: comment.trim(),
      updatedAt: new Date()
    };

    const updatedReview = await Review.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedReview) {
      return res.status(404).json({ 
        success: false, 
        message: 'Review not found' 
      });
    }

    console.log('Review updated successfully:', updatedReview._id);

    broadcastToClients('review_updated', updatedReview);

    res.json({ 
      success: true, 
      message: 'Review updated successfully!',
      data: updatedReview 
    });
  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating review: ' + error.message 
    });
  }
});

// Delete review
app.delete('/api/reviews/:id', async (req, res) => {
  try {
    const deletedReview = await Review.findByIdAndDelete(req.params.id);
    
    if (!deletedReview) {
      return res.status(404).json({ 
        success: false, 
        message: 'Review not found' 
      });
    }

    console.log('Review deleted successfully:', deletedReview._id);

    broadcastToClients('review_deleted', { id: deletedReview._id });

    res.json({ 
      success: true, 
      message: 'Review deleted successfully',
      data: { id: deletedReview._id }
    });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error deleting review: ' + error.message 
    });
  }
});

// ========== GENERAL ROUTES ==========

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Server is running!', 
    timestamp: new Date(),
    services: {
      database: 'MongoDB Atlas',
      uploads: 'Active',
      features: ['Inquiries', 'Announcements', 'Schools Gallery', 'Reviews']
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'JBMMSI Server API', 
    version: '1.0.0',
    endpoints: {
      'GET/POST /api/inquiries': 'Get/Create inquiries',
      'GET/POST /api/announcements': 'Get/Create announcements',
      'GET/POST /api/schools': 'Get/Create schools',
      'GET/POST /api/reviews': 'Get/Create reviews',
      'GET /api/health': 'Server health check'
    }
  });
});

// Error handling middleware for multer
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 5MB.'
      });
    }
  }
  res.status(500).json({ 
    success: false, 
    message: error.message 
  });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: 'API endpoint not found' });
});

// Start server with Socket.IO support
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔌 WebSocket server active on ws://localhost:${PORT}`);
  console.log(`📧 Inquiry API available at http://localhost:${PORT}/api/inquiries`);
  console.log(`📢 Announcements API available at http://localhost:${PORT}/api/announcements`);
  console.log(`🏫 Schools Gallery API available at http://localhost:${PORT}/api/schools`);
  console.log(`⭐ Reviews API available at http://localhost:${PORT}/api/reviews`);
  console.log(`🖼️ Uploads served from http://localhost:${PORT}/uploads/`);
});