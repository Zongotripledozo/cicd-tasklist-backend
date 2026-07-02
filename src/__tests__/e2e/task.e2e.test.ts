import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import testPrisma from "./setup.js";

// Mock the prisma singleton to use the test client
vi.mock("../../lib/prisma.js", () => ({
	default: testPrisma,
}));

// Import app AFTER mocking prisma
const { default: app } = await import("../../app.js");
import request from "supertest";

async function withTaskMethodMock(
	methodName: "create" | "findMany" | "findUnique",
	mockImplementation: (...args: unknown[]) => unknown,
	callback: () => Promise<void>
): Promise<void> {
	const originalMethod = testPrisma.task[methodName];
	(testPrisma.task as any)[methodName] = mockImplementation;
	try {
		await callback();
	} finally {
		(testPrisma.task as any)[methodName] = originalMethod;
	}
}

describe("Task API E2E Tests", () => {
	beforeEach(async () => {
		// Clean up database between tests
		await testPrisma.task.deleteMany();
	});

	afterAll(async () => {
		await testPrisma.$disconnect();
	});

	describe("POST /api/tasks", () => {
		it("should create a new task", async () => {
			const res = await request(app)
				.post("/api/tasks")
				.send({ title: "E2E Task", description: "E2E Description" });

			expect(res.status).toBe(201);
			expect(res.body).toHaveProperty("id");
			expect(res.body.title).toBe("E2E Task");
			expect(res.body.description).toBe("E2E Description");
			expect(res.body.completed).toBe(false);
		});

		it("should create a new task without description", async () => {
			const res = await request(app).post("/api/tasks").send({ title: "E2E Task Without Description" });

			expect(res.status).toBe(201);
			expect(res.body).toHaveProperty("id");
			expect(res.body.title).toBe("E2E Task Without Description");
			expect(res.body.description).toBeNull();
			expect(res.body.completed).toBe(false);
		});

		it("should return 400 when the title is missing", async () => {
			const res = await request(app).post("/api/tasks").send({ description: "Missing title" });

			expect(res.status).toBe(400);
			expect(res.body).toEqual({
				error: "Title is required and must be a non-empty string",
			});
		});

		it("should return 500 when persistence fails", async () => {
			await withTaskMethodMock(
				"create",
				vi.fn().mockRejectedValue(new Error("db error")),
				async () => {
					const res = await request(app)
						.post("/api/tasks")
						.send({ title: "Broken Task", description: "Broken" });

					expect(res.status).toBe(500);
					expect(res.body).toEqual({ error: "Failed to create task" });
				}
			);
		});
	});

	describe("GET /api/tasks", () => {
		it("should return the list of tasks", async () => {
			const task = await testPrisma.task.create({
				data: {
					title: "List Task",
					description: "Task for listing",
				},
			});

			const res = await request(app).get("/api/tasks");

			expect(res.status).toBe(200);
			expect(res.body).toHaveLength(1);
			expect(res.body[0]).toMatchObject({
				id: task.id,
				title: "List Task",
				description: "Task for listing",
				completed: false,
			});
		});

		it("should return 500 when the list query fails", async () => {
			await withTaskMethodMock(
				"findMany",
				vi.fn().mockRejectedValue(new Error("db error")),
				async () => {
					const res = await request(app).get("/api/tasks");

					expect(res.status).toBe(500);
					expect(res.body).toEqual({ error: "Failed to fetch tasks" });
				}
			);
		});
	});

	describe("GET /api/tasks/:id", () => {
		it("should return 200 for an existing task", async () => {
			const task = await testPrisma.task.create({
				data: {
					title: "Get Task",
					description: "Task for get by id",
				},
			});

			const res = await request(app).get(`/api/tasks/${task.id}`);

			expect(res.status).toBe(200);
			expect(res.body).toMatchObject({
				id: task.id,
				title: "Get Task",
				description: "Task for get by id",
				completed: false,
			});
		});

		it("should return 400 for an invalid task id", async () => {
			const res = await request(app).get("/api/tasks/not-a-number");

			expect(res.status).toBe(400);
			expect(res.body).toEqual({ error: "Invalid task ID" });
		});

		it("should return 404 for a missing task", async () => {
			const res = await request(app).get("/api/tasks/999999");

			expect(res.status).toBe(404);
			expect(res.body).toEqual({ error: "Task not found" });
		});

		it("should return 500 when fetching the task fails", async () => {
			await withTaskMethodMock(
				"findUnique",
				vi.fn().mockRejectedValue(new Error("db error")),
				async () => {
					const res = await request(app).get("/api/tasks/1");

					expect(res.status).toBe(500);
					expect(res.body).toEqual({ error: "Failed to fetch task" });
				}
			);
		});
	});

	describe("PUT /api/tasks/:id", () => {
		it("should update an existing task", async () => {
			const task = await testPrisma.task.create({
				data: {
					title: "Update Task",
					description: "Task before update",
				},
			});

			const res = await request(app)
				.put(`/api/tasks/${task.id}`)
				.send({
					title: "Updated Task",
					description: "Task after update",
					completed: true,
				});

			expect(res.status).toBe(200);
			expect(res.body).toMatchObject({
				id: task.id,
				title: "Updated Task",
				description: "Task after update",
				completed: true,
			});
		});

		it("should return 400 for an invalid task id", async () => {
			const res = await request(app).put("/api/tasks/not-a-number").send({ title: "Updated Task" });

			expect(res.status).toBe(400);
			expect(res.body).toEqual({ error: "Invalid task ID" });
		});

		it("should return 404 when updating a missing task", async () => {
			const res = await request(app)
				.put("/api/tasks/999999")
				.send({ title: "Updated Task" });

			expect(res.status).toBe(404);
			expect(res.body).toEqual({ error: "Task not found" });
		});

		it("should return 500 when updating the task fails", async () => {
			await withTaskMethodMock(
				"findUnique",
				vi.fn().mockRejectedValue(new Error("db error")),
				async () => {
					const res = await request(app)
						.put("/api/tasks/1")
						.send({ title: "Updated Task" });

					expect(res.status).toBe(500);
					expect(res.body).toEqual({ error: "Failed to update task" });
				}
			);
		});
	});

	describe("DELETE /api/tasks/:id", () => {
		it("should delete an existing task", async () => {
			const task = await testPrisma.task.create({
				data: {
					title: "Delete Task",
					description: "Task to delete",
				},
			});

			const res = await request(app).delete(`/api/tasks/${task.id}`);

			expect(res.status).toBe(204);
			expect(res.text).toBe("");
			const deleted = await testPrisma.task.findUnique({ where: { id: task.id } });
			expect(deleted).toBeNull();
		});

		it("should return 400 for an invalid task id", async () => {
			const res = await request(app).delete("/api/tasks/not-a-number");

			expect(res.status).toBe(400);
			expect(res.body).toEqual({ error: "Invalid task ID" });
		});

		it("should return 404 when deleting a missing task", async () => {
			const res = await request(app).delete("/api/tasks/999999");

			expect(res.status).toBe(404);
			expect(res.body).toEqual({ error: "Task not found" });
		});

		it("should return 500 when deleting the task fails", async () => {
			await withTaskMethodMock(
				"findUnique",
				vi.fn().mockRejectedValue(new Error("db error")),
				async () => {
					const res = await request(app).delete("/api/tasks/1");

					expect(res.status).toBe(500);
					expect(res.body).toEqual({ error: "Failed to delete task" });
				}
			);
		});
	});
});
