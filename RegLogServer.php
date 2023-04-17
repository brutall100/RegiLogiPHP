<?php
// Establish database connection
$servername = "localhost";
$username = "root";
$password = "";
$dbname = "reg_and_log";

$conn = mysqli_connect($servername, $username, $password, $dbname);

if (!$conn) {
  die("Connection failed: " . mysqli_connect_error());
}

// Handle registration form submission
if (isset($_POST['submitBtnReg'])) {
  $name = $_POST['nameInput'];
  $email = $_POST['emailInput'];
  $password = $_POST['passwordInput'];

  // Insert user data into database
  $sql = "INSERT INTO users_php (name_php, email_php, password_php) VALUES ('$name', '$email', '$password')";

  if (mysqli_query($conn, $sql)) {
    echo "Registration successful";
  } else {
    echo "Error: " . $sql . "<br>" . mysqli_error($conn);
  }
}

// Handle login form submission
if (isset($_POST['submitBtnLog'])) {
  $name = $_POST['login_name'];
  $password = $_POST['login_password'];

  // Check if user exists in database
  $sql = "SELECT * FROM users_php WHERE name_php='$name' AND password_php='$password'";
  $result = mysqli_query($conn, $sql);

  if (mysqli_num_rows($result) > 0) {
    echo "Login successful";
  } else {
    echo "Invalid username or password";
  }
}

// Close database connection
mysqli_close($conn);
?>