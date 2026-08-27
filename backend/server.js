require("dotenv").config();

const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// ─────────────────────────────
// MIDDLEWARE
// ─────────────────────────────

app.use(express.json());
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok"
  });
});

// ─────────────────────────────
// POSTGRESQL CONNECTION
// ─────────────────────────────

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// ─────────────────────────────
// SERVE WORKPLANNER FRONTEND
// ─────────────────────────────

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "index.html"));
});

// ─────────────────────────────
// GET ALL TASKS
// GET /api/tasks
// ─────────────────────────────

app.get("/api/tasks", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        title,
        description AS desc,
        day,
        priority,
        completed,
        created_at AS "createdAt"
      FROM tasks
      ORDER BY id ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching tasks:", error);

    res.status(500).json({
      error: "Failed to fetch tasks"
    });
  }
});

// ─────────────────────────────
// GET ONE TASK
// GET /api/tasks/:id
// ─────────────────────────────

app.get("/api/tasks/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        error: "Invalid task ID"
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        title,
        description AS desc,
        day,
        priority,
        completed,
        created_at AS "createdAt"
      FROM tasks
      WHERE id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Task not found"
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching task:", error);

    res.status(500).json({
      error: "Failed to fetch task"
    });
  }
});

// ─────────────────────────────
// CREATE TASK
// POST /api/tasks
// ─────────────────────────────

app.post("/api/tasks", async (req, res) => {
  try {
    const { title, desc, day, priority } = req.body;

    if (
      typeof title !== "string" ||
      title.trim().length === 0
    ) {
      return res.status(400).json({
        error: "Task title is required"
      });
    }

    const validDays = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday"
    ];

    const validPriorities = [
      "low",
      "medium",
      "high"
    ];

    const taskDay = day || "Monday";
    const taskPriority = priority || "medium";

    if (!validDays.includes(taskDay)) {
      return res.status(400).json({
        error: "Invalid day"
      });
    }

    if (!validPriorities.includes(taskPriority)) {
      return res.status(400).json({
        error: "Invalid priority"
      });
    }

    const result = await pool.query(
      `
      INSERT INTO tasks (
        title,
        description,
        day,
        priority
      )
      VALUES ($1, $2, $3, $4)
      RETURNING
        id,
        title,
        description AS desc,
        day,
        priority,
        completed,
        created_at AS "createdAt"
      `,
      [
        title.trim(),
        typeof desc === "string" ? desc.trim() : "",
        taskDay,
        taskPriority
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating task:", error);

    res.status(500).json({
      error: "Failed to create task"
    });
  }
});

// ─────────────────────────────
// UPDATE TASK
// PATCH /api/tasks/:id
// ─────────────────────────────

app.patch("/api/tasks/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        error: "Invalid task ID"
      });
    }

    const {
      title,
      desc,
      day,
      priority,
      completed
    } = req.body;

    const validDays = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday"
    ];

    const validPriorities = [
      "low",
      "medium",
      "high"
    ];

    const existing = await pool.query(
      `
      SELECT *
      FROM tasks
      WHERE id = $1
      `,
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: "Task not found"
      });
    }

    const currentTask = existing.rows[0];

    const updatedTitle =
      title !== undefined
        ? title.trim()
        : currentTask.title;

    const updatedDescription =
      desc !== undefined
        ? typeof desc === "string"
          ? desc.trim()
          : ""
        : currentTask.description;

    const updatedDay =
      day !== undefined
        ? day
        : currentTask.day;

    const updatedPriority =
      priority !== undefined
        ? priority
        : currentTask.priority;

    const updatedCompleted =
      completed !== undefined
        ? completed
        : currentTask.completed;

    if (!updatedTitle) {
      return res.status(400).json({
        error: "Task title cannot be empty"
      });
    }

    if (!validDays.includes(updatedDay)) {
      return res.status(400).json({
        error: "Invalid day"
      });
    }

    if (!validPriorities.includes(updatedPriority)) {
      return res.status(400).json({
        error: "Invalid priority"
      });
    }

    if (typeof updatedCompleted !== "boolean") {
      return res.status(400).json({
        error: "Completed must be true or false"
      });
    }

    const result = await pool.query(
      `
      UPDATE tasks
      SET
        title = $1,
        description = $2,
        day = $3,
        priority = $4,
        completed = $5
      WHERE id = $6
      RETURNING
        id,
        title,
        description AS desc,
        day,
        priority,
        completed,
        created_at AS "createdAt"
      `,
      [
        updatedTitle,
        updatedDescription,
        updatedDay,
        updatedPriority,
        updatedCompleted,
        id
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating task:", error);

    res.status(500).json({
      error: "Failed to update task"
    });
  }
});

// ─────────────────────────────
// DELETE TASK
// DELETE /api/tasks/:id
// ─────────────────────────────

app.delete("/api/tasks/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        error: "Invalid task ID"
      });
    }

    const result = await pool.query(
      `
      DELETE FROM tasks
      WHERE id = $1
      RETURNING
        id,
        title,
        description AS desc,
        day,
        priority,
        completed,
        created_at AS "createdAt"
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Task not found"
      });
    }

    res.json({
      message: "Task deleted successfully",
      task: result.rows[0]
    });
  } catch (error) {
    console.error("Error deleting task:", error);

    res.status(500).json({
      error: "Failed to delete task"
    });
  }
});

// ─────────────────────────────
// 404 HANDLER
// ─────────────────────────────

app.use((req, res) => {
  res.status(404).json({
    error: "Route not found"
  });
});

// ─────────────────────────────
// DATABASE + SERVER STARTUP
// ─────────────────────────────

async function startServer() {
  try {
    await pool.query("SELECT 1");

    console.log("Connected to PostgreSQL successfully.");

    app.listen(PORT, "0.0.0.0" ,() => {
      console.log(
        `WorkPlanner backend running on port ${PORT}`
      );
    });
  } catch (error) {
    console.error("Failed to connect to PostgreSQL:", error);
    process.exit(1);
  }
}

startServer();