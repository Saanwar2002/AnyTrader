import * as router from 'react-router-dom';
const exports = ['Link', 'useNavigate', 'useLocation'];
exports.forEach(e => {
  if (!(router as any)[e]) console.log('Missing router:', e);
});
