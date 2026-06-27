import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const getAllTasks = async () => {
    return await prisma.task.findMany({ orderBy: { position: "asc" } });
};

const getTaskById = async (id) => {
    return await prisma.task.findUnique({ where: { id } });
};

const createTask = async ({ title, assignee, deadline, effortHrs }) => {
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


const reorderTasks = async (orderedIds) => {
    const updates = orderedIds.map((id, index) =>
        prisma.task.update({
            where: { id },
            data: { position: index },
        })
    );
    await prisma.$transaction(updates);

    return await prisma.task.findMany({
        where: { id: { in: orderedIds } },
        orderBy: { position: "asc" },
    });
};

export { getAllTasks, getTaskById, createTask, updateTask, deleteTask, reorderTasks };