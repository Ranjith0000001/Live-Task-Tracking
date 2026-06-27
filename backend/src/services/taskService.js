const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Order by position so stable order is preserved across reloads
const getAllTasks = async () => {
    return await prisma.task.findMany({ orderBy: { position: "asc" } });
};

const getTaskById = async (id) => {
    return await prisma.task.findUnique({ where: { id } });
};

const createTask = async ({ title, assignee, deadline, effortHrs }) => {
    // New task goes to the end of the "todo" column
    const maxPositionRecord = await prisma.task.aggregate({
        where: { status: "todo" },
        _max: { position: true },
    });
    const nextPosition = (maxPositionRecord._max.position ?? -1) + 1;

    return await prisma.task.create({
        data: {
            title,
            status: "todo",
            assignee,
            deadline: new Date(deadline),
            effortHrs: parseFloat(effortHrs),
            position: nextPosition,
        },
    });
};

const updateTask = async (id, data) => {
    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) return null;

    // When moving to a different column, append to end of that column
    let positionUpdate = {};
    if (data.status !== undefined && data.status !== task.status) {
        const maxPositionRecord = await prisma.task.aggregate({
            where: { status: data.status },
            _max: { position: true },
        });
        positionUpdate = { position: (maxPositionRecord._max.position ?? -1) + 1 };
    }

    return await prisma.task.update({
        where: { id },
        data: {
            ...(data.title  !== undefined && { title:  data.title }),
            ...(data.status !== undefined && { status: data.status }),
            ...positionUpdate,
        },
    });
};

const deleteTask = async (id) => {
    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) return null;

    await prisma.task.delete({ where: { id } });
    return task;
};

// Persist a new order for one column.
// orderedIds: number[] — the task IDs in the desired order for that column.
const reorderTasks = async (orderedIds) => {
    // Run all position updates in a single transaction for atomicity
    const updates = orderedIds.map((id, index) =>
        prisma.task.update({
            where: { id },
            data: { position: index },
        })
    );
    await prisma.$transaction(updates);

    // Return the updated tasks in their new order
    return await prisma.task.findMany({
        where: { id: { in: orderedIds } },
        orderBy: { position: "asc" },
    });
};

module.exports = { getAllTasks, getTaskById, createTask, updateTask, deleteTask, reorderTasks };