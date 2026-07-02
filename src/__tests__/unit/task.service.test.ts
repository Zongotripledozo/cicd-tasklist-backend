import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Task } from "@prisma/client";

// Mock the prisma module before importing the service
vi.mock("../../lib/prisma.js", () => {
	return {
		default: {
			task: {
				findMany: vi.fn(),
				findUnique: vi.fn(),
				create: vi.fn(),
				update: vi.fn(),
				delete: vi.fn(),
			},
		},
	};
});

import prisma from "../../lib/prisma.js";
import * as taskService from "../../services/task.service.js";

const mockPrisma = vi.mocked(prisma);

const mockTask: Task = {
	id: 1,
	title: "Test Task",
	description: "A test task description",
	completed: false,
	createdAt: new Date("2026-01-01T00:00:00.000Z"),
	updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

const updatedTask: Task = {
	...mockTask,
	title: "Updated Task",
	description: "Updated description",
	completed: true,
};

describe("TaskService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("findAll", () => {
		it("should return all tasks ordered by createdAt desc", async () => {
			const tasks = [mockTask];
			(mockPrisma.task.findMany as any).mockResolvedValue(tasks);

			const result = await taskService.findAll();

			expect(result).toEqual(tasks);
			expect(mockPrisma.task.findMany).toHaveBeenCalledWith({
				orderBy: { createdAt: "desc" },
			});
		});

		it("should reject when listing tasks fails", async () => {
			(mockPrisma.task.findMany as any).mockRejectedValue(new Error("Database error"));

			await expect(taskService.findAll()).rejects.toThrow("Database error");
		});
	});

	describe("findById", () => {
		it("should return a task by id", async () => {
			(mockPrisma.task.findUnique as any).mockResolvedValue(mockTask);

			const result = await taskService.findById(1);

			expect(result).toEqual(mockTask);
			expect(mockPrisma.task.findUnique).toHaveBeenCalledWith({
				where: { id: 1 },
			});
		});

		it("should return null when the task does not exist", async () => {
			(mockPrisma.task.findUnique as any).mockResolvedValue(null);

			await expect(taskService.findById(999)).resolves.toBeNull();
		});
	});

	describe("create", () => {
		it("should create a task", async () => {
			(mockPrisma.task.create as any).mockResolvedValue(mockTask);

			const result = await taskService.create({
				title: mockTask.title,
				description: mockTask.description ?? undefined,
			});

			expect(result).toEqual(mockTask);
			expect(mockPrisma.task.create).toHaveBeenCalledWith({
				data: {
					title: mockTask.title,
					description: mockTask.description,
				},
			});
		});

		it("should create a task without description", async () => {
			(mockPrisma.task.create as any).mockResolvedValue(mockTask);

			await taskService.create({ title: mockTask.title });

			expect(mockPrisma.task.create).toHaveBeenCalledWith({
				data: {
					title: mockTask.title,
					description: undefined,
				},
			});
		});

		it("should reject when creating a task fails", async () => {
			(mockPrisma.task.create as any).mockRejectedValue(new Error("Create failed"));

			await expect(taskService.create({ title: "Task" })).rejects.toThrow("Create failed");
		});
	});

	describe("update", () => {
		it("should update an existing task", async () => {
			(mockPrisma.task.findUnique as any).mockResolvedValue(mockTask);
			(mockPrisma.task.update as any).mockResolvedValue(updatedTask);

			const result = await taskService.update(1, {
				title: updatedTask.title,
				description: updatedTask.description ?? undefined,
				completed: updatedTask.completed,
			});

			expect(result).toEqual(updatedTask);
			expect(mockPrisma.task.findUnique).toHaveBeenCalledWith({
				where: { id: 1 },
			});
			expect(mockPrisma.task.update).toHaveBeenCalledWith({
				where: { id: 1 },
				data: {
					title: updatedTask.title,
					description: updatedTask.description ?? undefined,
					completed: updatedTask.completed,
				},
			});
		});

		it('should throw "Task not found" when updating a missing task', async () => {
			(mockPrisma.task.findUnique as any).mockResolvedValue(null);

			await expect(
				taskService.update(999, {
					title: "Missing",
				})
			).rejects.toThrow("Task not found");
			expect(mockPrisma.task.update).not.toHaveBeenCalled();
		});

		it("should reject when updating a task fails after it exists", async () => {
			(mockPrisma.task.findUnique as any).mockResolvedValue(mockTask);
			(mockPrisma.task.update as any).mockRejectedValue(new Error("Update failed"));

			await expect(
				taskService.update(1, {
					title: "Updated Task",
				})
			).rejects.toThrow("Update failed");
		});
	});

	describe("remove", () => {
		it("should remove an existing task", async () => {
			(mockPrisma.task.findUnique as any).mockResolvedValue(mockTask);
			(mockPrisma.task.delete as any).mockResolvedValue(mockTask);

			const result = await taskService.remove(1);

			expect(result).toEqual(mockTask);
			expect(mockPrisma.task.findUnique).toHaveBeenCalledWith({
				where: { id: 1 },
			});
			expect(mockPrisma.task.delete).toHaveBeenCalledWith({
				where: { id: 1 },
			});
		});

		it('should throw "Task not found" when removing a missing task', async () => {
			(mockPrisma.task.findUnique as any).mockResolvedValue(null);

			await expect(taskService.remove(999)).rejects.toThrow("Task not found");
			expect(mockPrisma.task.delete).not.toHaveBeenCalled();
		});

		it("should reject when deleting a task fails after it exists", async () => {
			(mockPrisma.task.findUnique as any).mockResolvedValue(mockTask);
			(mockPrisma.task.delete as any).mockRejectedValue(new Error("Delete failed"));

			await expect(taskService.remove(1)).rejects.toThrow("Delete failed");
		});
	});
});
