#!/bin/bash
# Deploy Sable booking widget to public web directory
set -e

sudo mkdir -p /var/www/sable-widget
sudo cp /home/jake/sable/apps/booking-widget/dist/* /var/www/sable-widget/
sudo cp /home/jake/sable/apps/booking-widget/test.html /var/www/sable-widget/
echo "Widget deployed to /var/www/sable-widget/"
