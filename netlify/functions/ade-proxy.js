export const handler = async (event) => {
  const resources = event.queryStringParameters?.resources || '19976'
  const url = `https://adecons.unistra.fr/jsp/custom/modules/plannings/anonymous_cal.jsp?resources=${resources}&projectId=7&calType=ical&nbWeeks=2`

  try {
    const res = await fetch(url)
    if (!res.ok) return { statusCode: res.status, body: 'ADE error' }
    const text = await res.text()
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300',
      },
      body: text,
    }
  } catch (err) {
    return { statusCode: 500, body: err.message }
  }
}
