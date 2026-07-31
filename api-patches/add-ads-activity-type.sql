-- Ads activities need 'Ads' on activities.activity_type (MySQL ENUM).
-- Without this, POST activity_type='Ads' stores an empty type and Ads
-- disappear after refresh. Run once in phpMyAdmin on u186687036_merlin:
--
ALTER TABLE `activities`
  MODIFY COLUMN `activity_type`
  ENUM('Email','Call','WhatsApp','LinkedIn','Meeting','Demo','Ads')
  NOT NULL;

-- Optional: fix rows already logged as Ads (notes kept, type blanked by ENUM):
-- UPDATE `activities`
-- SET `activity_type` = 'Ads'
-- WHERE (`activity_type` = '' OR `activity_type` IS NULL)
--   AND (`notes` LIKE 'Ads logged%' OR `notes` LIKE '[Ads]%');
