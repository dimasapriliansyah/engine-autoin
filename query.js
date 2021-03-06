const findQueue = `SELECT 
                      sessionId,
                      channelId
                    FROM 
                      interaction_header
                    WHERE
                      agentUsername IS NULL
                    ORDER BY 
                      createdAt`

const findAgent = `SELECT
                      a.agentUsername,
                      a.channelId,
                      a.slot,
                      a.\`limit\`,
                      a.lastDist,
                      a.\`limit\` - slot AS remain,
                      b.isLogin
                    FROM work_order a 
                      LEFT JOIN user  b ON (a.agentUsername=b.username)
                    WHERE isAux = 0 AND  (a.\`limit\` - a.slot ) > 0
                    ORDER BY 
                      lastDist ASC,
                      remain DESC
`

const updateWorkOrder = () => {
  const query = ` UPDATE work_order
                  SET 
                    \`limit\` = ?,
                    slot = ?,
                    lastDist = ?
                  WHERE
                    agentUsername = ?
                    AND
                    channelId = ?`

  return query

}

const updateInteractionHeader = () => {
  const query = ` UPDATE interaction_header
                  SET 
                    agentUsername = ?,
                    pickupDate = ?
                  WHERE
                    sessionId = ?`

  return query

}

module.exports = {
  findQueue,
  findAgent,
  updateWorkOrder,
  updateInteractionHeader
}