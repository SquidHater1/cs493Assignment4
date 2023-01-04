const amqp = require('amqplib')

const rabbitmqHost = process.env.RABBITMQ_HOST || 'localhost'
const rabbitmqUrl = `amqp://${rabbitmqHost}`

let connection = null
let channel = null

exports.connectToRabbitMQ = async function (queue) {
    console.log("== rabbitmqhost: ", rabbitmqHost)
    connection = await amqp.connect(rabbitmqUrl)
    channel = await connection.createChannel()
    await channel.assertQueue(queue)
}

exports.getChannel = function () {
    return channel
}