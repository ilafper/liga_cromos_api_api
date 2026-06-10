const app = require('./app');

const port = process.env.PORT || 3000;
app.listen(3000, '0.0.0.0', () => {
  console.log('runrun');
  console.log(`Listening: http://localhost:${port}`);
});

