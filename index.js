const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 5000;

// Setup Socket.io with CORS
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
  },
});

app.use(cors());
app.use(express.json());

// MongoDB Connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.iciu9bb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let db, usersCollections, jobTaskCollections;

async function connectDB() {
  try {
    await client.connect();
    db = client.db("JobTaskDB");
    usersCollections = db.collection("Users");
    jobTaskCollections = db.collection("JobTask");
    console.log("Connected to MongoDB!");
  } catch (error) {
    console.error("MongoDB connection error:", error);
  }
}
connectDB();

// Socket.io Connection Handling
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  //users collection related api
  //Post Request
  socket.on("add_user", async (newUser) => {
    try {
      const result = await usersCollections.insertOne(newUser);
      // console.log(task);
      if (result.acknowledged) {
        // Notify all clients
        io.emit("user_added", { message: "New User Added", newUser });

        // Send confirmation to sender
        socket.emit("user_added_successfully", {
          message: "User Added Successfully",
        });
      }
    } catch (error) {
      console.error("Error adding user:", error);
      socket.emit("task_error", { message: "Failed to add user" });
    }
  });

  //jobs task collection related api
  //Delete Request

  socket.on("delete_task", async (taskId) => {
    try {
      if (!taskId || typeof taskId !== "string") {
        socket.emit("task_error", { message: "Invalid task ID" });
        return;
      }

      const result = await jobTaskCollections.deleteOne({
        _id: new ObjectId(taskId),
      });

      if (result.deletedCount > 0) {
        console.log(`Task ${taskId} deleted`);

        // Notify all clients about the deleted task
        io.emit("task_deleted", taskId);
      } else {
        console.log("Task not found");
        socket.emit("task_error", { message: "Task not found" });
      }
    } catch (error) {
      console.error("Error deleting task:", error);
      socket.emit("task_error", { message: "Failed to delete task" });
    }
  });

  //Update Request

  socket.on("update_task", async (updatedTask) => {
    try {
      // Validate the input task
      if (!updatedTask || typeof updatedTask._id !== "string") {
        socket.emit("task_error", { message: "Invalid task ID or task data" });
        return;
      }

      // Extract task details
      const { _id, title, description, category } = updatedTask;

      // Convert _id to ObjectId
      const objectId = new ObjectId(_id);

      // Perform the update in the database
      const result = await jobTaskCollections.updateOne(
        { _id: objectId }, // Find task by ID
        { $set: { title, description, category } } // Update fields
      );

      // Check if the update was acknowledged and modified
      if (result.modifiedCount === 0) {
        socket.emit("task_error", {
          message: "Task update failed or no changes made",
        });
        return;
      }

      // Fetch the updated task from the database
      const updatedTaskFromDB = await jobTaskCollections.findOne({
        _id: objectId,
      });

      // Emit the updated task to all connected clients
      socket.emit("task_updated", updatedTaskFromDB);
    } catch (error) {
      console.error("Error updating task:", error);
      socket.emit("task_error", {
        message: "Server error while updating task",
      });
    }
  });

  //Get Request
  socket.on("getting_task", async () => {
    try {
      const tasks = await jobTaskCollections.find().toArray();
      // console.log("55", tasks);
      socket.emit("task_data", { tasks });
    } catch (error) {
      console.error("Error getting tasks:", error);
      socket.emit("task_error", { message: "Failed to get tasks" });
    }
  });

  //Post Request
  socket.on("add_task", async (task) => {
    try {
      const result = await jobTaskCollections.insertOne(task);
      // console.log(task);
      if (result.acknowledged) {
        // Notify all clients
        io.emit("task_added", { message: "New Task Added", task });

        // Send confirmation to sender
        socket.emit("task_added_success", {
          message: "Task Added Successfully",
        });
      }
    } catch (error) {
      console.error("Error adding task:", error);
      socket.emit("task_error", { message: "Failed to add task" });
    }
  });

  // socket.on("disconnect", () => {
  //   console.log("User disconnected:", socket.id);
  // });
});

// Basic API Route
app.get("/", (req, res) => {
  res.send("Job-Task-1 Going On");
});

// Start Server
server.listen(port, () => {
  console.log(`Server running on port: ${port}`);
});
