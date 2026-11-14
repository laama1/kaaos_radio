<?php

declare(strict_types=1);

const ICECAST_STATUS_URL = 'https://stream.kaaosradio.fi:8001/status-json.xsl';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-cache, no-store, must-revalidate');

$request = curl_init(ICECAST_STATUS_URL);

if ($request === false) {
    error_log('Unable to initialize the Icecast status request.');
    http_response_code(500);
    echo json_encode(['error' => 'Unable to request the Icecast status.']);
    exit;
}

curl_setopt_array($request, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 3,
    CURLOPT_TIMEOUT => 5,
]);

$response = curl_exec($request);
$statusCode = curl_getinfo($request, CURLINFO_RESPONSE_CODE);

if ($response === false) {
    error_log('Icecast status request failed: ' . curl_error($request));
    http_response_code(502);
    echo json_encode(['error' => 'Unable to retrieve the Icecast status.']);
    exit;
}

if ($statusCode !== 200) {
    error_log("Icecast status request returned HTTP {$statusCode}.");
    http_response_code(502);
    echo json_encode(['error' => 'The Icecast status service returned an error.']);
    exit;
}

json_decode($response, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    error_log('Icecast status response was not valid JSON: ' . json_last_error_msg());
    http_response_code(502);
    echo json_encode(['error' => 'The Icecast status response was invalid.']);
    exit;
}

echo $response;
