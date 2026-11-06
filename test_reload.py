from selenium import webdriver
from selenium.webdriver.common.by import By
import time

options = webdriver.ChromeOptions()
options.add_argument('--headless')
driver = webdriver.Chrome(options=options)

driver.get("file:///Users/dncnguyen/Antigravity/DNC Operator/finance/index.html")

# Set local storage
driver.execute_script("localStorage.setItem('finance_user', 'test');")
driver.execute_script("localStorage.setItem('finance_last_view', 'transactions');")

# Refresh page
driver.refresh()
time.sleep(2)

# Check active tab
active_tabs = driver.find_elements(By.CSS_SELECTOR, '.view-container.active')
for tab in active_tabs:
    print("ACTIVE TAB ID:", tab.get_attribute('id'))

# Get console logs
for entry in driver.get_log('browser'):
    print("LOG:", entry)

driver.quit()
