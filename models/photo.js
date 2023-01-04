/*
 * Photo schema and data accessor methods.
 */

const fs = require('fs')

const { ObjectId, GridFSBucket } = require('mongodb')

const { getDbReference } = require('../lib/mongo')
const { extractValidFields } = require('../lib/validation')

/*
 * Schema describing required/optional fields of a photo object.
 */
const PhotoSchema = {
  businessId: { required: true },
  caption: { required: false },
  path: { require: false },
  filename: { require: false },
  mimetype: { require: false }
}
exports.PhotoSchema = PhotoSchema

exports.savePhotoFile = function (photo) {
  photo = extractValidFields(photo, PhotoSchema)
  photo.businessId = ObjectId(photo.businessId)
  return new Promise(function (resolve, reject) {
    const db = getDbReference()
    const bucket = new GridFSBucket(db, {bucketName: 'photos'})
    const metadata = {
      businessId: photo.businessId,
      mimetype: photo.mimetype,
      filename: photo.filename
    }
    if(photo.caption){
      metadata.caption = photo.caption
    }

    const uploadStream = bucket.openUploadStream(photo.filename, {
      metadata: metadata
    })
    fs.createReadStream(photo.path).pipe(uploadStream)
      .on('error', function (err) {
        reject(err)
      })
      .on('finish', function (result) {
        console.log("== stream result: ", result)
        resolve(result._id)
      })
  })
}

exports.removeUploadedPhoto = function(photo) {
  return new Promise( function (resolve, reject) {
    fs.unlink(photo.path)
      .on('error', function (err) {
        reject(err)
      })
      .on('finish', function (result){
        resolve()
      })
  })
}

/*
 * Executes a DB query to insert a new photo into the database.  Returns
 * a Promise that resolves to the ID of the newly-created photo entry.
 */
async function insertNewPhoto(photo) {
  photo = extractValidFields(photo, PhotoSchema)
  photo.businessId = ObjectId(photo.businessId)
  const db = getDbReference()
  const collection = db.collection('photos')
  const result = await collection.insertOne(photo)
  return result.insertedId
}
exports.insertNewPhoto = insertNewPhoto

/*
 * Executes a DB query to fetch a single specified photo based on its ID.
 * Returns a Promise that resolves to an object containing the requested
 * photo.  If no photo with the specified ID exists, the returned Promise
 * will resolve to null.
 */
async function getPhotoById(id) {
  const db = getDbReference()
  const bucket = new GridFSBucket(db, { bucketName: 'photos' })
  if (!ObjectId.isValid(id)) {
    return null
  } else {
    const results = await bucket
      .find({ _id: new ObjectId(id) })
      .toArray()
    return results[0]
  }
}
exports.getPhotoById = getPhotoById

async function getPhotoByFilename(filename){
  const db = getDbReference()
  const bucket = new GridFSBucket(db, { bucketName: 'photos' })
  if(!filename){
    return null
  } else {
    const results = await bucket.find({ 'metadata.filename': filename }).toArray()
    return results[0]
  }
}
exports.getPhotoByFilename = getPhotoByFilename

async function getPhotosByBusinessId(businessId) {
  const db = getDbReference()
  const bucket = new GridFSBucket(db, { bucketName: 'photos' })
  if(!ObjectId.isValid(businessId)) {
    return null
  } else {
    const results = await bucket
      .find({ 'metadata.businessId': new ObjectId(businessId) })
      .toArray()
    return results
  }
}
exports.getPhotosByBusinessId = getPhotosByBusinessId

exports.getPhotoDownloadStream = function (filename) {
  const db = getDbReference()
  const bucket = new GridFSBucket(db, { bucketName: 'photos' })
  return bucket.openDownloadStreamByName(filename)
}

exports.getDownloadStreamById = function (id) {
  const db = getDbReference()
  const bucket = new GridFSBucket(db, { bucketName: 'photos' })
  if(!ObjectId.isValid(id)) {
    return null
  } else {
    return bucket.openDownloadStream(new ObjectId(id))
  }
}
/*
exports.updateThumbnailById = async function (id, thumbnailId){
  const db = getDBReference()
  const bucket = new GridFSBucket(db, {bucketName: 'photos'})
  if(!ObjectId.isValid(id)) {
    return null
  }else{
    const result = await bucket.
  }
}
*/