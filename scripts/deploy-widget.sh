#!/bin/bash
# Deploy OpenSeat booking widget to public web directory
set -e

sudo mkdir -p /var/www/openseat-widget
sudo cp /root/openseat/apps/booking-widget/dist/* /var/www/openseat-widget/
sudo cp /root/openseat/apps/booking-widget/test.html /var/www/openseat-widget/
echo "Widget deployed to /var/www/openseat-widget/"
