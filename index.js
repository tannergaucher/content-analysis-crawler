const csv = require('csv-parser')
const fs = require('fs')
const puppeteer = require('puppeteer')
const language = require('@google-cloud/language')

const results = []

// Parse CSV file and push to results array.
function parseCSV() {
  fs.createReadStream('capitalistexploits.csv')
    .pipe(
      csv([
        'URL',
        'Scheme',
        'HTTP Status Code',
        'HTTP Status',
        'Content Type',
        'Title',
        'Title Length',
        'No. Titles',
        'Meta Description',
        'Meta Description Length',
        'No. Meta Descriptions',
        'H1',
        'H1 Length',
        'No. H1s',
        'No. Content Words',
        'No. Template Words',
        'No. Words',
        'No. Sentences',
        'No. Paragraphs',
        'Reading Time (mm:ss)',
        'Flesch Kincaid Reading Ease',
        'Sentiment',
        'No. Internal Linking URLs',
        'Link Equity Score',
        'Indexable Status',
        'Crawl Depth',
        'Crawl Source',
        'URL Source',
        'First Parent URL',
      ])
    )
    .on('data', data => {
      results.push(data)
    })

    .on('end', () => {
      console.log('results finished')
      iterateResults()
    })
}

parseCSV()

// Take a post result off front of results array and call crawlPost function with post result URL.
function iterateResults() {
  console.log(`Iterating result ${results.length}`)

  if (results.length > 0) {
    const currentPost = results.shift()
    crawlPost(currentPost.URL)
  }
}

// Crawl post URL, post content is innerText of  <div class="entry-content">
async function crawlPost(url) {
  console.log(`Crawling post ${url}`)

  try {
    const browser = await puppeteer.launch()
    const page = await browser.newPage()
    await page.goto(url)
    const postContent = await page.$eval('.entry-content', el => el.innerText)

    // Run the post content against the machine learning API.
    return getAttributesFromPostContent(postContent, url)
  } catch (error) {
    // If no post content, try again with next result.
    console.log(error)
    iterateResults()
  }
}

// This function runs post content against natural language api and saves data to a json file.
async function getAttributesFromPostContent(postContent, url) {
  try {
    const client = new language.LanguageServiceClient()
    const document = {
      content: postContent,
      type: 'PLAIN_TEXT',
    }

    const [classification] = await client.classifyText({ document })

    // Entities returns a LOT of data. Ignore for now.
    // const [entities] = await client.analyzeEntities({ document });
    // console.log(entities);

    const postData = {
      url,
      classification,
      // entities
    }

    // Save returned data to a json file.
    fs.readFile('./data.json', (error, data) => {
      let json = JSON.parse(data)
      json.push(postData)
      fs.writeFile('./data.json', JSON.stringify(json), error => {
        if (error) {
          console.log(error)
        } else {
          console.log(`Post ${url} successfully classified`)
          //   Move on to next post
          iterateResults()
        }
      })
    })
  } catch (error) {
    console.log(error)
    // Move on to next post anyway
    iterateResults()
  }
}
