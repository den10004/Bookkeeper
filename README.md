# Bookkeeper

{
"name": "manager2",
"email": "manager2@example.com",
"password": "manager2",
"role": "manager"
}

Роли
accountant, director, manager

---

Создание пользователя
POST http://localhost:3000/auth/register

{
"username": "accountant1",
"email": "accountant1@example.com",
"password": "accountant1",
"role": "accountant"
}

---

---

Вход пользователя
POST http://localhost:3000/auth/login

{
"email": "director@example.com",
"password": "director"
}

---

Получение пользователя
GET http://localhost:3000/protected/me

токен пользователя

---

Получение всех пользователей (для директора)
GET http://localhost:3000/protected/users

токен

--

Изменение данных пользователя (для директора)
PUT http://localhost:3000/protected/users/:id

токен

--

Удаление данных пользователя (для директора)
DELETE http://localhost:3000/protected/users/:id

токен

--
