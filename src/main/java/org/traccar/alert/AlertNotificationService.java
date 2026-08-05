package org.traccar.alert;

import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.traccar.helper.DateUtil;
import org.traccar.model.Alert;
import org.traccar.model.AlertEvent;
import org.traccar.model.Device;
import org.traccar.model.Geofence;
import org.traccar.model.Position;
import org.traccar.model.User;
import org.traccar.notification.NotificationMessage;
import org.traccar.notification.NotificatorManager;
import org.traccar.notificators.Notificator;
import org.traccar.session.cache.CacheManager;
import org.traccar.storage.Storage;
import org.traccar.storage.StorageException;
import org.traccar.storage.query.Columns;
import org.traccar.storage.query.Condition;
import org.traccar.storage.query.Request;

import java.util.Collection;
import java.util.Locale;
import java.util.Map;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.concurrent.ExecutorService;

@Singleton
public class AlertNotificationService {

    private static final Logger LOGGER = LoggerFactory.getLogger(AlertNotificationService.class);

    public static final String CHANNEL_PLATFORM = "platform";
    public static final String CHANNEL_TELEGRAM = "telegram";

    private final Storage storage;
    private final CacheManager cacheManager;
    private final NotificatorManager notificatorManager;
    private final ExecutorService executorService;
    private final AlertRecipientRepository alertRecipientRepository;
    private final AlertSecurity alertSecurity;

    private final Map<String, Boolean> deliveredEvents = java.util.Collections.synchronizedMap(
            new LinkedHashMap<>(128, 0.75f, true) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<String, Boolean> eldest) {
                    return size() > 10000;
                }
            });

    @Inject
    public AlertNotificationService(
            Storage storage, CacheManager cacheManager, NotificatorManager notificatorManager,
            ExecutorService executorService, AlertRecipientRepository alertRecipientRepository,
            AlertSecurity alertSecurity) {
        this.storage = storage;
        this.cacheManager = cacheManager;
        this.notificatorManager = notificatorManager;
        this.executorService = executorService;
        this.alertRecipientRepository = alertRecipientRepository;
        this.alertSecurity = alertSecurity;
    }

    public boolean isChannelEnabled(Alert alert, String channel, boolean defaultValue) {
        Object notifications = alert.getAttributes().get("notifications");
        if (notifications == null) {
            return defaultValue;
        }
        if (notifications instanceof Map<?, ?> options) {
            return Boolean.TRUE.equals(options.get(channel));
        }
        if (notifications instanceof Collection<?> options) {
            return options.stream().map(String::valueOf).anyMatch(channel::equalsIgnoreCase);
        }
        String value = String.valueOf(notifications);
        return java.util.Arrays.stream(value.split(","))
                .map(String::trim)
                .anyMatch(channel::equalsIgnoreCase);
    }

    public void sendAsync(Alert alert, AlertEvent alertEvent) {
        if (!isChannelEnabled(alert, CHANNEL_TELEGRAM, false)) {
            return;
        }
        try {
            executorService.execute(() -> sendTelegram(alert, alertEvent));
        } catch (RuntimeException e) {
            LOGGER.warn("Telegram task rejected for alert event {}", alertEvent.getId(), e);
        }
    }

    private void sendTelegram(Alert alert, AlertEvent alertEvent) {
        int sent = 0;
        int skippedNoChat = 0;
        int skippedNoPermission = 0;
        int failed = 0;
        try {
            List<Long> recipientIds = alertRecipientRepository.getUserIds(alert.getId());
            if (recipientIds.isEmpty()) {
                LOGGER.warn("Telegram alert {} has no recipients", alert.getId());
                return;
            }
            List<User> users = getUsers(recipientIds);

            Device device = cacheManager.getObject(Device.class, alertEvent.getDeviceId());
            if (device == null) {
                device = storage.getObject(Device.class, new Request(
                        new Columns.All(), new Condition.Equals("id", alertEvent.getDeviceId())));
            }
            Position position = getPosition(alertEvent);
            Geofence geofence = alertEvent.getGeofenceId() > 0
                    ? cacheManager.getObject(Geofence.class, alertEvent.getGeofenceId()) : null;
            if (geofence == null && alertEvent.getGeofenceId() > 0) {
                geofence = storage.getObject(Geofence.class, new Request(
                        new Columns.All(), new Condition.Equals("id", alertEvent.getGeofenceId())));
            }

            String subject = escape(alert.getName() != null ? alert.getName() : "Alerta EliteTrack");
            String message = buildMessage(alert, alertEvent, device, geofence, position);
            boolean priority = Alert.SEVERITY_HIGH.equals(alertEvent.getSeverity())
                    || Alert.SEVERITY_CRITICAL.equals(alertEvent.getSeverity());
            NotificationMessage notificationMessage = new NotificationMessage(subject, message, message, priority);
            Notificator notificator = null;
            for (User user : users) {
                String deliveryKey = alertEvent.getId() + ":" + user.getId() + ":" + CHANNEL_TELEGRAM;
                synchronized (deliveredEvents) {
                    if (deliveredEvents.putIfAbsent(deliveryKey, Boolean.TRUE) != null) {
                        continue;
                    }
                }
                if (!user.hasAttribute("telegramChatId") || user.getString("telegramChatId").isBlank()) {
                    skippedNoChat++;
                    continue;
                }
                try {
                    if (!alertSecurity.canAccessDevice(user.getId(), alertEvent.getDeviceId())) {
                        skippedNoPermission++;
                        continue;
                    }
                    if (notificator == null) {
                        notificator = notificatorManager.getNotificator(CHANNEL_TELEGRAM);
                    }
                    notificator.send(user, notificationMessage, null, position);
                    sent++;
                } catch (Exception e) {
                    failed++;
                    LOGGER.warn("Telegram delivery failed for alert event {} recipient {}",
                            alertEvent.getId(), user.getId(), e);
                }
            }
            int missingUsers = recipientIds.size() - users.size();
            failed += Math.max(0, missingUsers);
            LOGGER.info("Alert {} Telegram delivery summary: sent={}, skippedNoChat={}, "
                            + "skippedNoPermission={}, failed={}",
                    alert.getId(), sent, skippedNoChat, skippedNoPermission, failed);
        } catch (Exception e) {
            LOGGER.warn("Telegram delivery failed for alert event {}", alertEvent.getId(), e);
        }
    }

    private List<User> getUsers(List<Long> userIds) throws StorageException {
        Condition condition = null;
        for (long userId : new java.util.LinkedHashSet<>(userIds)) {
            Condition next = new Condition.Equals("id", userId);
            condition = condition == null ? next : new Condition.Or(condition, next);
        }
        return condition != null
                ? storage.getObjects(User.class, new Request(new Columns.All(), condition)).stream()
                        .filter(user -> !user.getDisabled())
                        .filter(user -> user.getExpirationTime() == null
                                || user.getExpirationTime().after(new java.util.Date()))
                        .toList()
                : List.of();
    }

    private Position getPosition(AlertEvent alertEvent) throws StorageException {
        Position position = null;
        if (alertEvent.getPositionId() > 0) {
            position = storage.getObject(Position.class, new Request(
                    new Columns.All(), new Condition.Equals("id", alertEvent.getPositionId())));
        }
        return position != null ? position : cacheManager.getPosition(alertEvent.getDeviceId());
    }

    private String buildMessage(
            Alert alert, AlertEvent alertEvent, Device device, Geofence geofence, Position position) {
        String deviceName = device != null ? device.getName() : alertEvent.getDeviceName();
        StringBuilder result = new StringBuilder();
        if (Alert.TYPE_GEOFENCE_ENTER.equals(alertEvent.getType()) && geofence != null) {
            result.append("Vehículo ").append(escape(deviceName)).append(" ingresó a la geocerca ")
                    .append(escape(geofence.getName()));
        } else if (Alert.TYPE_GEOFENCE_EXIT.equals(alertEvent.getType()) && geofence != null) {
            result.append("Vehículo ").append(escape(deviceName)).append(" salió de la geocerca ")
                    .append(escape(geofence.getName()));
        } else {
            result.append("Vehículo: ").append(escape(deviceName));
        }
        result.append("\nTipo: ").append(escape(alertEvent.getType()));
        result.append("\nSeveridad: ").append(escape(alertEvent.getSeverity()));
        if (alertEvent.getEventTime() != null) {
            result.append("\nFecha: ").append(DateUtil.formatDate(alertEvent.getEventTime()));
        }
        if (alertEvent.getMessage() != null && !alertEvent.getMessage().isBlank()) {
            result.append("\nMensaje: ").append(escape(alertEvent.getMessage()));
        }
        if (geofence != null && !Alert.TYPE_GEOFENCE_ENTER.equals(alertEvent.getType())
                && !Alert.TYPE_GEOFENCE_EXIT.equals(alertEvent.getType())) {
            result.append("\nGeocerca: ").append(escape(geofence.getName()));
        }
        if (position != null) {
            result.append(String.format(Locale.US, "\nUbicación: %.6f, %.6f",
                    position.getLatitude(), position.getLongitude()));
        }
        return result.toString();
    }

    private String escape(String value) {
        if (value == null) {
            return "-";
        }
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
