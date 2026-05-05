
export async function insertOne(model, doc) {
    return await model.create(doc)
}

export async function insertMany(model, docs) {
    return await model.insertMany(docs)
}