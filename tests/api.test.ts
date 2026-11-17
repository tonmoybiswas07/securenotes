import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { User } from '../src/models/user.model';
import { Note } from '../src/models/note.model';
import { Post } from '../src/models/post.model';

let database: MongoMemoryReplSet;
let server: Server;
let base: string;
let alice: any, bob: any, admin: any, aliceNote: any;

async function request(path: string, method = 'GET', body?: unknown, token?: string) {
  const response = await fetch(`${base}/api${path}`, {
    method, headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = response.status === 204 ? undefined : await response.json();
  return { status: response.status, data };
}

before(async () => {
  database = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: { downloadDir: '/tmp/secure-notes-mongodb-binaries' }
  });
  process.env.MONGODB_URI = database.getUri('secure-notes-test');
  process.env.JWT_SECRET = 'integration-test-only-secret-at-least-32-characters';
  const { app } = await import('../src/app');
  await mongoose.connect(process.env.MONGODB_URI);
  await Promise.all([User.init(), Note.init(), Post.init()]);
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing server address');
  base = `http://127.0.0.1:${address.port}`;
}, { timeout: 180000 });

after(async () => {
  if (server) await new Promise<void>(resolve => server.close(() => resolve()));
  await mongoose.disconnect();
  if (database) await database.stop();
});

test('registration hashes passwords, normalizes email, and blocks privilege escalation', async () => {
  const registered = await request('/auth/register', 'POST', {
    name: 'Alice', email: ' Alice@Example.com ', password: 'Password123!', interests: ['chess', 'reading', 'chess'],
  });
  assert.equal(registered.status, 201); alice = registered.data;
  assert.equal(alice.user.email, 'alice@example.com');
  assert.equal(alice.user.password, undefined);
  assert.deepEqual(alice.user.interests, ['chess', 'reading']);
  const stored = await User.findById(alice.user._id).select('+password');
  assert.notEqual(stored!.password, 'Password123!');
  assert.match(stored!.password, /^\$2[aby]\$/);
  const escalation = await request('/auth/register', 'POST', {
    name: 'Evil', email: 'evil@example.com', password: 'Password123!', role: 'admin',
  });
  assert.equal(escalation.status, 400);
  assert.equal((await request('/auth/register', 'POST', {
    name: 'Duplicate', email: 'alice@example.com', password: 'Password123!',
  })).status, 409);
  bob = (await request('/auth/register', 'POST', {
    name: 'Bob', email: 'bob@example.com', password: 'Password123!', interests: ['chess'],
  })).data;
  admin = (await request('/auth/register', 'POST', {
    name: 'Admin', email: 'admin@example.com', password: 'Password123!',
  })).data;
  await User.findByIdAndUpdate(admin.user._id, { role: 'admin' });
});

test('login, profile, invalid tokens, and authentication guards', async () => {
  assert.equal((await request('/auth/login', 'POST', { email: 'alice@example.com', password: 'wrongpass' })).status, 401);
  const login = await request('/auth/login', 'POST', { email: 'alice@example.com', password: 'Password123!' });
  assert.equal(login.status, 200);
  assert.equal((await request('/auth/me', 'GET', undefined, login.data.token)).data.user.password, undefined);
  assert.equal((await request('/notes')).status, 401);
  assert.equal((await request('/notes', 'GET', undefined, 'broken-token')).status, 401);
  assert.equal((await request('/users', 'GET', undefined, alice.token)).status, 403);
});

test('note ownership is enforced on reads, updates, deletes, and mass assignment', async () => {
  aliceNote = (await request('/notes', 'POST', { title: 'Private', content: 'Alice secret' }, alice.token)).data.note;
  const path = `/notes/${aliceNote._id}`;
  assert.equal((await request(path, 'GET', undefined, bob.token)).status, 404);
  assert.equal((await request(path, 'PATCH', { title: 'Stolen' }, bob.token)).status, 404);
  assert.equal((await request(path, 'DELETE', undefined, bob.token)).status, 404);
  assert.equal((await request('/notes', 'GET', undefined, bob.token)).data.pagination.total, 0);
  assert.equal((await request(path, 'GET', undefined, admin.token)).status, 200);
  assert.equal((await request(path, 'PATCH', { title: 'Admin edit' }, admin.token)).status, 404);
  assert.equal((await request(path, 'DELETE', undefined, admin.token)).status, 404);
  assert.equal((await request(path, 'PATCH', { owner: bob.user._id }, alice.token)).status, 400);
  const updated = await request(path, 'PATCH', { title: 'Updated' }, alice.token);
  assert.equal(updated.data.note.title, 'Updated');
  assert.equal(updated.data.note.content, 'Alice secret');
});

test('lists paginate deterministically and reject invalid input', async () => {
  await request('/notes', 'POST', { title: 'Second', content: 'Another' }, alice.token);
  const first = await request('/notes?limit=1&page=1', 'GET', undefined, alice.token);
  const second = await request('/notes?limit=1&page=2', 'GET', undefined, alice.token);
  assert.equal(first.data.notes.length, 1);
  assert.equal(first.data.pagination.total, 2);
  assert.notEqual(first.data.notes[0]._id, second.data.notes[0]._id);
  for (const path of ['/notes?page=0', '/notes?limit=101', '/notes?limit=abc', '/notes/not-an-id']) {
    assert.equal((await request(path, 'GET', undefined, alice.token)).status, 400);
  }
  assert.equal((await request('/notes', 'POST', { title: '', content: 'x' }, alice.token)).status, 400);
});

test('admin user management omits passwords and partial updates preserve interests', async () => {
  const created = await request('/users', 'POST', {
    name: 'Managed', email: 'managed@example.com', password: 'Password123!', interests: ['coding'],
  }, admin.token);
  assert.equal(created.status, 201);
  assert.equal(created.data.user.password, undefined);
  const id = created.data.user._id;
  const updated = await request(`/users/${id}`, 'PATCH', { name: 'Renamed' }, admin.token);
  assert.deepEqual(updated.data.user.interests, ['coding']);
  assert.equal(updated.data.user.password, undefined);
  const listed = await request('/users?limit=1', 'GET', undefined, admin.token);
  assert.equal(listed.data.users.length, 1);
  assert.equal(listed.data.pagination.total, 4);
  assert.equal((await request(`/users/${id}`, 'GET', undefined, admin.token)).data.user.name, 'Renamed');
  assert.equal((await request(`/users/${admin.user._id}`, 'DELETE', undefined, admin.token)).status, 400);
  assert.equal((await request(`/users/${admin.user._id}`, 'PATCH', { role: 'user' }, admin.token)).status, 400);
});

test('interest aggregation groups users, filters, bounds previews, and paginates groups', async () => {
  const result = await request('/users/interests?limit=1&usersPerGroup=1', 'GET', undefined, admin.token);
  assert.equal(result.status, 200);
  assert.equal(result.data.groups.length, 1);
  assert.equal(result.data.groups[0].interest, 'chess');
  assert.equal(result.data.groups[0].totalUsers, 2);
  assert.equal(result.data.groups[0].users.length, 1);
  assert.equal(result.data.groups[0].users[0].password, undefined);
  assert.equal(result.data.pagination.total, 3);
  const filtered = await request('/users/interests?interest=reading', 'GET', undefined, admin.token);
  assert.equal(filtered.data.groups.length, 1);
  assert.equal(filtered.data.groups[0].users[0]._id, alice.user._id);
  const members = await request('/users?interest=chess&limit=1&page=2', 'GET', undefined, admin.token);
  assert.equal(members.data.users.length, 1);
  assert.equal(members.data.pagination.total, 2);
});

test('public posts and indexed lookup return only the selected user posts with pagination', async () => {
  assert.equal((await request('/posts', 'POST', { title: 'x', content: 'y' })).status, 401);
  await request('/posts', 'POST', { title: 'Alice first', content: 'Public' }, alice.token);
  await request('/posts', 'POST', { title: 'Alice second', content: 'Public' }, alice.token);
  await request('/posts', 'POST', { title: 'Bob post', content: 'Public' }, bob.token);
  const all = await request('/posts?limit=1');
  assert.equal(all.data.posts.length, 1);
  assert.equal(all.data.pagination.total, 3);
  const mine = await request(`/users/${alice.user._id}/posts?limit=1&page=2`);
  assert.equal(mine.status, 200);
  assert.equal(mine.data.posts.length, 1);
  assert.equal(mine.data.posts[0].author, alice.user._id);
  assert.equal(mine.data.pagination.total, 2);
  const empty = await request(`/users/${admin.user._id}/posts`);
  assert.deepEqual(empty.data.posts, []);
  assert.equal(empty.data.pagination.total, 0);
  assert.equal((await request('/users/000000000000000000000000/posts')).status, 404);
});

test('only required indexes exist and ownership lists use an index without a sort stage', async () => {
  assert.equal((await User.collection.indexes()).length, 3);
  assert.equal((await Note.collection.indexes()).length, 2);
  assert.equal((await Post.collection.indexes()).length, 2);
  const plan = await Note.find({ owner: alice.user._id }).sort({ _id: -1 }).explain('executionStats');
  const winningPlan = JSON.stringify(plan.queryPlanner.winningPlan);
  assert.match(winningPlan, /owner_1__id_-1/);
  assert.doesNotMatch(winningPlan, /"stage":"SORT"/);
  const userPlan = await User.find({ interests: 'chess' }).sort({ _id: -1 }).explain('executionStats');
  assert.match(JSON.stringify(userPlan.queryPlanner.winningPlan), /interests_1__id_-1/);
  assert.doesNotMatch(JSON.stringify(userPlan.queryPlanner.winningPlan), /"stage":"SORT"/);
});

test('user deletion atomically removes content and invalidates existing bearer tokens', async () => {
  const response = await request(`/users/${bob.user._id}`, 'DELETE', undefined, admin.token);
  assert.equal(response.status, 204);
  assert.equal(await Post.countDocuments({ author: bob.user._id }), 0);
  assert.equal(await Note.countDocuments({ owner: bob.user._id }), 0);
  assert.equal((await request('/auth/me', 'GET', undefined, bob.token)).status, 401);
  assert.equal((await request(`/users/${bob.user._id}`, 'GET', undefined, admin.token)).status, 404);
  await User.findByIdAndUpdate(admin.user._id, { role: 'user' });
  assert.equal((await request('/users', 'GET', undefined, admin.token)).status, 403);
});

test('serves the frontend and returns safe errors for malformed requests', async () => {
  assert.equal((await fetch(base)).status, 200);
  assert.equal((await fetch(`${base}/app.js`)).status, 200);
  assert.equal((await request('/missing')).status, 404);
  const malformed = await fetch(`${base}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken',
  });
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).message, 'Invalid JSON body');
});
