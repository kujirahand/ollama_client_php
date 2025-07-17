<?php
// redirect to app/index.php
$scheme = isset($_SERVER['REQUEST_SCHEME']) ? $_SERVER['REQUEST_SCHEME'] : 'http';
$baseUrl = $scheme . '://' . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'];
//header("Location: $baseUrl/app/index.php");
$appUrl = $baseUrl . 'app/index.php';
// redirect to app/index.php
header("Location: $appUrl");
echo "<html><body>";
echo "<a href='$appUrl'>index.php</a>";
echo "</body></html>";
