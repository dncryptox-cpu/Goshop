import urllib.request
import csv
import io

url = 'https://docs.google.com/spreadsheets/d/1sdL8wF3pLDZ6V_mUqG2aVmI5f60foDzD0ZA0CmC6m3c/gviz/tq?tqx=out:csv&sheet=APP_DATA'
req = urllib.request.Request(url)
response = urllib.request.urlopen(req)
csv_data = response.read().decode('utf-8')
reader = csv.reader(io.StringIO(csv_data))
headers = next(reader)
print("Headers:", headers)
count = 0
for row in reader:
    row_dict = dict(zip(headers, row))
    ref = row_dict.get('Người giới thiệu', '') or row_dict.get('Affiliate', '') or row_dict.get('CTV', '')
    if ref:
        print(f"Row {count} has ref: {ref}")
    count += 1
    if count > 10: break
