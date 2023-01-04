const { connectToDb, getDbReference } = require('./lib/mongo')
const { connectToRabbitMQ, getChannel } = require('./lib/rabbitmq')
const { getDownloadStreamById } = require('./models/photo')
const sharp = require('sharp')
const { ObjectId, GridFSBucket } = require('mongodb')
const fs = require('fs')
const mkdirp = require('mkdirp')

const queue = 'photos'
const destination = `${__dirname}/thumbnails/`



connectToDb(async function () {
    await connectToRabbitMQ(queue)
    const channel = getChannel()
    channel.consume(queue, async function (msg) {
        if(msg){
            const id = msg.content.toString()
            const downloadStream = getDownloadStreamById(id)

            const photoData = []
            downloadStream.on('data', function (data) {
                photoData.push(data)
            })
            downloadStream.on('end', async function () {
                const buf = Buffer.concat(photoData)
                const filename = id + ".jpg"
                //const filepath = destination + filename
                //console.log("== Filepath: ", filepath)
                //const madeDir = await mkdirp(destination)
                //console.log("== Made directory: ", madeDir)
                resizedImage = await sharp(buf)
                    .resize(100, 100)
                    .toFormat('jpeg')
                    .toBuffer((err, buffer, info) => {
                        if(err) {
                            console.log(err)
                        }
                        if(buffer) {
                            return buffer
                        }
                    })


                const thumbnail = {
                    photoId: new ObjectId(id),
                    filename: filename
                }

                const thumbId = await saveThumbFile(thumbnail, resizedImage)
            })
        }
        channel.ack(msg)
    })
})

function saveThumbFile(thumbnail, resizedImage) {
    return new Promise(function (resolve, reject) {
        const db = getDbReference()
        const bucket = new GridFSBucket(db, {bucketName: 'thumbnails'})
        const metadata = {
            photoId: thumbnail.photoId
        }

        const uploadStream = bucket.openUploadStream(thumbnail.filename, {
            metadata: metadata
        })
        resizedImage.pipe(uploadStream)
        /*
        fs.createReadStream(thumbnail.path).pipe(uploadStream)
            .on('error', function (err) {
                reject(err)
            })
            .on('finish', function (result) {
                resolve(result._id)
            })
            */
    })
}
