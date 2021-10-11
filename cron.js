// require the AWS SDK
const AWS = require('aws-sdk')
const rdsDataService = new AWS.RDSDataService()

exports.handler = (event, context, callback) => {
  // prepare SQL command
  let sqlParams = {
    secretArn: process.env.SECRET_ARN,
    resourceArn: process.env.RDS_ARN,
    sql: 'select relname from pg_class;',
    database: 'campaigns',
    includeResultMetadata: true
  }

  // run SQL command
  rdsDataService.executeStatement(sqlParams, function (err, data) {
    if (err) {
      // error
      console.log(err)
      callback('Query Failed')
    } else {
      // init
      var rows = []
      var cols =[]

      // build an array of columns
      data.columnMetadata.map((v, i) => {
        cols.push(v.name)
      });

      // build an array of rows: { key=>value }
      data.records.map((r) => {
        var row = {}
        r.map((v, i) => {
          if (v.stringValue !== "undefined") { row[cols[i]] = v.stringValue; }
          else if (v.blobValue !== "undefined") { row[cols[i]] = v.blobValue; }
          else if (v.doubleValue !== "undefined") { row[cols[i]] = v.doubleValue; }
          else if (v.longValue !== "undefined") { row[cols[i]] = v.longValue; }
          else if (v.booleanValue !== "undefined") { row[cols[i]] = v.booleanValue; }
          else if (v.isNull) { row[cols[i]] = null; }
        })
        rows.push(row)
      })

      // done
      console.log('Found rows: ' + rows.length)
      callback(null, rows)
    }
  })
}
