-- Sliding Window Rate Limiter
-- Key: ratelimit:resource:identifier
-- ARGV[1]: Current timestamp (ms)
-- ARGV[2]: Window size (ms)
-- ARGV[3]: Max requests (limit)

local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])

local clearBefore = now - window

-- Remove old entries outside the window
redis.call('ZREMRANGEBYSCORE', key, 0, clearBefore)

-- Count entries in the current window
local count = redis.call('ZCARD', key)

local allowed = count < limit
local remaining = limit - count - 1

if allowed then
    -- Add current request
    redis.call('ZADD', key, now, now)
    -- Refresh TTL
    redis.call('PEXPIRE', key, window)
else
    remaining = 0
end

-- Return: [allowed (0/1), remaining_count, reset_time_ms]
-- reset_time_ms is the approximate time until one slot opens up
local earliest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local resetTime = 0
if #earliest > 0 then
    resetTime = tonumber(earliest[2]) + window
end

return {allowed and 1 or 0, remaining, resetTime}
