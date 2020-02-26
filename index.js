require('dotenv').config()
const Promise = require('bluebird')
const date = require('date-and-time')
const lodash = require('lodash')
const cron = require('node-cron');

const db = require('./database')
const query = require('./query')

async function autoin() {
  try {
    const [queues] = await db.query(query.findQueue);
    const [agents] = await db.query(query.findAgent)
    let vagents = JSON.parse(JSON.stringify([...agents]))
    const workorders = []

    // BERSIHIN QUEUE YG CHANNEL ID NYA GA ADA AGENTNYA
    queues.forEach((queue, queueIndex) => {
      const { sessionId, channelId } = queue
      const agentPerChannel = lodash.filter(agents, { channelId });
      if (agentPerChannel.length === 0) {
        let indexesRemoved = []
        queues.forEach((queue, index) => {
          if (queue.channelId === channelId) {
            indexesRemoved.push(index)
          }
        })
        indexesRemoved.forEach((removed) => {
          queues.splice(removed, 1)
        })
      }
    })

    while (queues.length !== 0 && agents.length !== 0) {
      console.log("INSANITY CHECKPOINT")
      queues.forEach((queue, queueIndex) => {
        const { sessionId, channelId: channelIdQueue } = queue
        agents.forEach((agent, agentIndex) => {
          let { limit, slot, agentUsername, channelId } = agent
          const lastDist = date.format(new Date(), 'YYYY-MM-DD HH:mm:ss')
          if (limit - slot > 0 && channelIdQueue == channelId) {
            limit--
            slot++
            const workorder = {
              sessionId,
              agentUsername,
              channelId,
              pickupDate: lastDist
            }
            workorders.push(workorder)
            agents[agentIndex].limit = limit
            agents[agentIndex].slot = slot
            agents[agentIndex].lastDist = lastDist;

            vagents[agentIndex].limit = limit
            vagents[agentIndex].slot = slot
            vagents[agentIndex].lastDist = lastDist;

            queues.splice(queueIndex, 1)
          } else if (limit - slot <= 0) {
            vagents[agentIndex].limit = limit
            vagents[agentIndex].slot = slot
            vagents[agentIndex].lastDist = agent.lastDist;
            agents.splice(agentIndex, 1)
          }
        })
      })
    }

    // UPDATE WORKORDER
    await Promise.each(vagents, async (agent, index) => {
      const { agentUsername, channelId, limit, slot, lastDist } = agent
      const queryUpdateWorkOrder = query.updateWorkOrder()
      const [result] = await db.query(queryUpdateWorkOrder,
        [agentUsername, channelId, limit, slot, lastDist, agentUsername, agentUsername, channelId]
      )
    })

    // UPDATE INTERACTION_HEADER
    await Promise.each(workorders, async (workorder, index) => {
      const { agentUsername, sessionId, pickupDate } = workorder
      const queryUpdateInteractionHeader = query.updateInteractionHeader()
      const result = await db.query(queryUpdateInteractionHeader, [agentUsername, pickupDate, sessionId])
      const dateDistribution = date.format(new Date(), 'YYYY-MM-DD HH:mm:ss')
      console.log(`[AUTOIN] [${dateDistribution}] ${sessionId} -> ${agentUsername}`)
    })

    return true

  } catch (error) {
    console.error(error)
    return error
  }
}

cron.schedule('*/10 * * * * *', autoin);