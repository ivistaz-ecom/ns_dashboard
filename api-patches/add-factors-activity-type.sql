-- Factors activities need 'Factors' on activities.activity_type (MySQL ENUM).
-- Without this, POST activity_type='Factors' stores an empty type and Factors
-- disappear after refresh. Run once in phpMyAdmin on u186687036_merlin:
--
ALTER TABLE `activities`
  MODIFY COLUMN `activity_type`
  ENUM('Email','Call','WhatsApp','LinkedIn','Meeting','Demo','Ads','Factors')
  NOT NULL;

-- Optional: fix rows already logged as Factors (notes kept, type blanked by ENUM):
-- UPDATE `activities`
-- SET `activity_type` = 'Factors'
-- WHERE (`activity_type` = '' OR `activity_type` IS NULL)
--   AND (`notes` LIKE 'Factors logged%' OR `notes` LIKE '[Factors]%');
