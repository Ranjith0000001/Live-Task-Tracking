function groupTasksByStatus(tasks) {
    const grouped = { 
        todo: [], 
        inprogress: [], 
        done: [] 
    };
    
    tasks.forEach(task => {
        if (grouped[task.status]) {
            grouped[task.status].push(task);
        }
    });
    
    return grouped;
}

export { groupTasksByStatus };