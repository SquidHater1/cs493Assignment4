/*
 * API sub-router for businesses collection endpoints.
 */

const multer = require('multer')
const crypto = require('crypto')

const { Router } = require('express')
const { getChannel } = require('../lib/rabbitmq')

const { validateAgainstSchema } = require('../lib/validation')
const {
  PhotoSchema,
  insertNewPhoto,
  getPhotoById,
  savePhotoFile,
  removeUploadedPhoto
} = require('../models/photo')

const queue = 'photos'

const router = Router()


const fileTypes = {
  'image/jpeg': 'jpg',
  'image/png': 'png'
}

const upload = multer({
  storage: multer.diskStorage({
    destination: `${__dirname}/uploads`,
    filename: function (req, file, callback) {
      const ext = fileTypes[file.mimetype]
      const filename = crypto.pseudoRandomBytes(16).toString('hex')
      console.log(`${filename}.${ext}`)
      callback(null, `${filename}.${ext}`)
    }
  }),
  fileFilter: function (req, file, callback) {
    callback(null, !!fileTypes[file.mimetype])
  }
})

/*
 * POST /photos - Route to create a new photo.
 */
router.post('/', upload.single('image') , async (req, res) => {
  console.log("== req.file: ", req.file)
  console.log("== req.body: ", req.body)
  if(req.file && req.body && validateAgainstSchema(req.body, PhotoSchema)){
    try {
      imageVar = {}
      if(req.body.caption){
        imageVar = {
          businessId: req.body.businessId,
          caption: req.body.caption,
          path: req.file.path,
          filename: req.file.filename,
          mimetype: req.file.mimetype
        }
      }else{
        imageVar = {
          businessId: req.body.businessId,
          path: req.file.path,
          filename: req.file.filename,
          mimetype: req.file.mimetype
        }
      }
      //const id = await insertNewPhoto(imageVar)
      const id = await savePhotoFile(imageVar)
      //await removeUploadedPhoto(imageVar)

      const channel = getChannel()
      channel.sendToQueue(queue, Buffer.from(id.toString()))
      res.status(201).send({
        id: id,
        links: {
          photo: `/photos/${id}`,
          business: `/businesses/${req.body.businessId}`
        }
      })
    } catch (err) {
      console.error(err)
      res.status(500).send({
        error: "Error inserting photo into DB. Please try again later."
      })
    }
  }else{
    res.status(400).send({
      error: "Request body is not a valid photo object"
    })
  }
  
  /*
  if (validateAgainstSchema(req.body, PhotoSchema)) {
    try {
      const id = await insertNewPhoto(req.body)
      res.status(201).send({
        id: id,
        links: {
          photo: `/photos/${id}`,
          business: `/businesses/${req.body.businessId}`
        }
      })
    } catch (err) {
      console.error(err)
      res.status(500).send({
        error: "Error inserting photo into DB.  Please try again later."
      })
    }
  } else {
    res.status(400).send({
      error: "Request body is not a valid photo object"
    })
  }
  */
})

/*
 * GET /photos/{id} - Route to fetch info about a specific photo.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const photo = await getPhotoById(req.params.id)
    console.log("== got photo: ", photo._id)
    if (photo) {
      const resBody = {
        _id: photo._id,
        url: `/media/photos/${photo._id}`,
        thumbnail: `/media/thumbs/${photo._id}`,
        mimetype: photo.metadata.mimetype,
        businessId: photo.metadata.businessId
      }
      res.status(200).send(resBody)
    } else {
      next()
    }
  } catch (err) {
    console.error(err)
    res.status(500).send({
      error: "Unable to fetch photo.  Please try again later."
    })
  }
})

module.exports = router
