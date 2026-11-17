# Deployment: Render + MongoDB Atlas


এটি deployment plan; service এখনো publish করা হয়নি। Backend ও basic frontend একই Node service-এ থাকবে। নিচের dashboard ধাপগুলো service তৈরি করার সময় অনুসরণ করবে।

১) GitHub-এ code push শেষ করো। Render-এ login করে New → Web Service থেকে repo connect করো। Runtime Node এবং branch main বেছে নাও। Static Site বেছে নেবে না; এই app-এর Express server লাগে।

২) Build command: npm ci --include=dev && npm run build
Start command: npm start
Health check path: /api/health
Node version: 24 (NODE_VERSION environment variable দিয়ে pin করা যায়)। TypeScript build-এর জন্য devDependencies দরকার।

৩) Hosting environment variables দাও:
MONGODB_URI = তোমার Atlas URI (বাস্তব value শুধু Render-এ)
JWT_SECRET = নতুন random secret, অন্তত 32 characters
CLIENT_ORIGIN = service-এর আসল https://...onrender.com URL
NODE_ENV = production
NODE_VERSION = 24
PORT নিজে 5001 করে set করবে না; platform-এর দেওয়া PORT ব্যবহার করবে।

৪) Render service-এর Connect → Outbound থেকে outbound IP ranges নাও। Atlas Network Access-এ সেই CIDR ranges allowlist করো। Atlas URI-তে database user-এর credentials দেবে, Atlas website login credentials নয়। Password-এর special characters URL-encode করতে হবে।

৫) Deploy করো। Logs-এ database connected ও API listening দেখবে। Live /api/health-এ status=ok, homepage, register/login, note CRUD, admin views ও lookup পরীক্ষা করো। URL জানা গেলে CLIENT_ORIGIN update করে restart/deploy করো। Same-origin frontend-এর fetch path বদলাতে হবে না।

৬) প্রথম admin local seed:admin দিয়েই বানানো যায়, যদি local .env একই Atlas database-এর দিকে point করে। Set ADMIN_EMAIL ও ADMIN_PASSWORD, তারপর npm run seed:admin। Existing account seed overwrite করবে না। Real admin password repository-তে রাখবে না।

৭) Reverse proxy-এর পেছনে client-IP handling যাচাই করো। বর্তমান app trust proxy configure করে না; shared proxy IP rate-limit-এ users-কে একসঙ্গে limit করতে পারে। Platform topology নিশ্চিত করে সঠিক trust policy set ও test করবে; অন্ধভাবে trust proxy=true দেবে না। In-memory rate limits multi-instance-এ shared নয়।

৮) Free Render service 15 মিনিট idle থাকলে sleep করতে পারে; পরের request-এ startup delay হয়। Interview demo-এর আগে URL খুলে ready রাখবে। এটি demo option; production hosting requirements আলাদা করে বিচার করবে।


## Official references


তথ্য যাচাই: ১৭ নভেম্বর ২০২৬। Dashboard labels ও plans বদলাতে পারে।
Render Express deployment: https://render.com/docs/deploy-node-express-app
Render Web Services: https://render.com/docs/web-services
Render Outbound IPs: https://render.com/docs/outbound-ip-addresses
Render Free services: https://render.com/docs/free
Render Node versions: https://render.com/docs/node-version
Atlas IP Access List: https://www.mongodb.com/docs/atlas/security/ip-access-list/

