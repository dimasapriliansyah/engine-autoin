require('dotenv').config()
const Promise = require('bluebird')
const date = require('date-and-time')
const lodash = require('lodash')
const cron = require('node-cron');
const axios = require('axios')

const db = require('./database')
const query = require('./query')
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
async function pickupBySession(username, sessionId) {
  const BASE_URL = process.env.BASE_URL
  return axios.post(BASE_URL + '/interaction/pickupBySession', {
    username,
    sessionId
  })
    .then(function (response) {
      console.log("pickupBySession response", response.data);
    })
    .catch(function (error) {
      console.error("error", error.message)
      // console.error("pickupBySession response", JSON.stringify(error.response.data, null, 2));
    });
}

async function updateWorkOrder(data) {
  const { agentUsername: username, channelId, slot, lastDist } = data
  const BASE_URL = process.env.BASE_URL
  return axios.post(BASE_URL + '/autoin/updateWorkOrder', {
    username,
    channelId,
    slot,
    lastDist
  })
    .then(function (response) {
      console.log("updateWorkOrder response", response.data);
    })
    .catch(function (error) {
      console.error("error", error.message)
      // console.error("updateWorkOrder response", JSON.stringify(error.response.data, null, 2));
    });
}

async function autoin() {
  console.log("autoin")
  try {
    const [queues] = await db.query(query.findQueue);
    console.log("queues", queues)
    const [agents] = await db.query(query.findAgent)
    console.log("agents", agents)
    let vagents = JSON.parse(JSON.stringify([...agents]))
    const workorders = []

    if (queues.length === 0 || agents.length === 0) {
      return true
    }

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
          const lastDist = new Date()
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
      const { agentUsername, channelId, slot, lastDist } = agent
      return updateWorkOrder(agent)
      const queryUpdateWorkOrder = query.updateWorkOrder()
      const [result] = await db.query(queryUpdateWorkOrder,
        [limit, slot, lastDist, agentUsername, channelId]
      )
    })

    // UPDATE INTERACTION_HEADER
    await Promise.each(workorders, async (workorder, index) => {
      const { agentUsername, sessionId, pickupDate } = workorder
      return pickupBySession(agentUsername, sessionId)
      const queryUpdateInteractionHeader = query.updateInteractionHeader()

      const result = await db.query(queryUpdateInteractionHeader, [agentUsername, pickupDate, sessionId])
      const dateDistribution = date.format(new Date(), 'YYYY-MM-DD HH:mm:ss')
      console.log(`[AUTOIN] [${dateDistribution}] ${sessionId} -> ${agentUsername}`)
    })

    return true

  } catch (error) {
    console.error(error)
    process.exit(1)
    return error
  }
}

cron.schedule('*/10 * * * * *', autoin);