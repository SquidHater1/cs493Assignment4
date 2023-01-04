const express = require('express')
const morgan = require('morgan')

const api = require('./api')
const { connectToDb, getDbReference } = require('./lib/mongo')
const { connectToRabbitMQ, getChannel } = require('./lib/rabbitmq')
const {getPhotoDownloadStream, getPhotoById, getPhotoByFilename, getDownloadStreamById} = require('./models/photo')
const { ObjectId, GridFSBucket } = require('mongodb')

const queue = 'photos'

const app = express()
const port = process.env.PORT || 8000

/*
 * Morgan is a popular logger.
 */
app.use(morgan('dev'))

app.use(express.json())
app.use(express.static('public'))

/*
 * All routes for the API are written in modules in the api/ directory.  The
 * top-level router lives in api/index.js.  That's what we include here, and
 * it provides all of the routes.
 */
app.use('/', api)

//app.use('/media/photos/', express.static(`${__dirname}/api/uploads`))
app.get('/media/photos/:id', function (req, res, next) {
  try {
    getDownloadStreamById(req.params.id)
      .on('file', function (file) {
        res.status(200).type(file.metadata.mimetype)
      })
      .on('error', function (err) {
        if(err.code === 'ENOENT') {
          next()
        }else{
          next(err)
        }
      })
      .pipe(res)
  } catch (err) {
    console.error(err)
    res.status(500).send({
      error: "Unable to fetch photo.  Please try again later."
    })
  }
})


app.get('/media/thumbs/:id', async function (req, res, next) {
  try {
    const downloadStream = await getThumbnailDownloadStream(req.params.id)
    downloadStream.pipe(res)
  } catch (err) {
    console.error(err)
    res.status(500).send({
      error: "Unable to fetch thumbnail.  Please try again later."
    })
  }
})

async function getThumbnailDownloadStream(id) {
  const db = getDbReference()
  const bucket = new GridFSBucket(db, { bucketName: 'thumbnails' })

  const results = await bucket.find({ 'metadata.photoId': new ObjectId(id) }).toArray()
  const thumbnailId = results[0]._id

  return bucket.openDownloadStream(new ObjectId(thumbnailId))
}


app.use('*', function (req, res, next) {
  res.status(404).json({
    error: "Requested resource " + req.originalUrl + " does not exist"
  })
})

connectToDb( async function () {
  await connectToRabbitMQ(queue)
  app.listen(port, function () {
    console.log("== Server is running on port", port)
  })
})
