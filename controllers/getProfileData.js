const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  QueryCommand,
} = require("@aws-sdk/lib-dynamodb");

const ddbclient = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const ddbDocClient = DynamoDBDocumentClient.from(ddbclient);

const getProfileData = async (req, res) => {
  console.log(req.body)
  const userID = req.body.username;
  try {
    const params = {
      TableName: process.env.DYNAMODB_PROJECTS_TABLE,
      KeyConditionExpression: "UserID = :uid",
      ExpressionAttributeValues: {
        ":uid": userID,
      },
    };
    const data = await ddbDocClient.send(new QueryCommand(params));
    res.json(data.Items);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = getProfileData;
