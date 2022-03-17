
const Sequelize = require('dynamo-sequelize');
const config = {
  define: {
    saveUnknown: true,
    timestamps: true,
    jsonAsObject: true,
  },
  logging: false,
  throughput: {
    read: process.env.DYNAMO_READ || 20,
    write: process.env.DYNAMO_WRITE || 10
  }
};

if (process.env.DIALECT === 'dynamodb') {
  config.dialect = 'dynamo';
}

const sequelize = new Sequelize(
  process.env.DATABASE_URL,
  config
);
  
 

exports.sequelize = sequelize;